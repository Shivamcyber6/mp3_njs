"""Generate the original demo tracks in public/tracks/.

Every sound here is synthesized from scratch (no samples), so the tracks are free to ship and use.
Run:  python3 scripts/make-demo-tracks.py      (needs numpy and ffmpeg)
"""

import json
import os
import subprocess
import tempfile
import wave

import numpy as np

SR = 44100
OUT = os.path.join(os.path.dirname(__file__), "..", "public", "tracks")
NOTE = {"C": 0, "C#": 1, "D": 2, "D#": 3, "E": 4, "F": 5, "F#": 6, "G": 7, "G#": 8, "A": 9, "A#": 10, "B": 11}


def hz(midi):
    return 440.0 * 2 ** ((midi - 69) / 12)


def chord(root, quality):
    shape = {"maj": [0, 4, 7, 11], "min": [0, 3, 7, 10], "dom": [0, 4, 7, 10], "sus": [0, 5, 7, 10]}[quality]
    return [root + s for s in shape]


def lowpass(x, cutoff):
    # one-pole low-pass, vectorised via cumulative filter on chunks
    a = np.exp(-2 * np.pi * cutoff / SR)
    y = np.empty_like(x)
    acc = 0.0
    # chunked python loop is fast enough for our lengths
    for i in range(0, len(x), 4096):
        seg = x[i : i + 4096]
        out = np.empty_like(seg)
        for j, v in enumerate(seg):
            acc = (1 - a) * v + a * acc
            out[j] = acc
        y[i : i + 4096] = out
    return y


def env(n, attack, release, shape="exp"):
    t = np.arange(n) / SR
    e = np.minimum(1.0, t / max(attack, 1e-4))
    if shape == "exp":
        e *= np.exp(-t / max(release, 1e-4))
    else:
        tail = np.clip((n / SR - t) / max(release, 1e-4), 0, 1)
        e *= tail
    return e


def saw(f, n, detune=0.0):
    t = np.arange(n) / SR
    out = np.zeros(n)
    for d in (-detune, 0, detune):
        ph = (t * f * (1 + d)) % 1.0
        out += 2 * ph - 1
    return out / 3


def tri(f, n):
    t = np.arange(n) / SR
    return 2 * np.abs(2 * ((t * f) % 1.0) - 1) - 1


def place(buf, sig, start, pan=0.0):
    s = int(start * SR)
    if s >= len(buf):
        return
    e = min(len(buf), s + len(sig))
    sig = sig[: e - s]
    buf[s:e, 0] += sig * np.sqrt(0.5 * (1 - pan))
    buf[s:e, 1] += sig * np.sqrt(0.5 * (1 + pan))


def kick(n=int(0.45 * SR)):
    t = np.arange(n) / SR
    f = 45 + 110 * np.exp(-t * 28)
    ph = 2 * np.pi * np.cumsum(f) / SR
    return np.sin(ph) * np.exp(-t * 7) * 0.9


def snare(rng, n=int(0.25 * SR)):
    t = np.arange(n) / SR
    noise = rng.uniform(-1, 1, n)
    noise = noise - lowpass(noise, 900)
    body = np.sin(2 * np.pi * 190 * t) * np.exp(-t * 30)
    return (noise * 0.5 * np.exp(-t * 18) + body * 0.4)


def hat(rng, open_=False):
    n = int((0.18 if open_ else 0.05) * SR)
    t = np.arange(n) / SR
    noise = rng.uniform(-1, 1, n)
    noise = np.diff(np.concatenate([[0], noise]))
    return noise * np.exp(-t * (14 if open_ else 70)) * 0.16


def delay(buf, time, feedback, mix):
    d = int(time * SR)
    wet = np.zeros_like(buf)
    src = buf.copy()
    for k in range(1, 6):
        g = feedback**k
        if g < 0.02:
            break
        wet[d * k :] += src[: len(src) - d * k] * g
    # ping-pong: swap channels on the wet signal
    wet = wet[:, ::-1]
    return buf + wet * mix


def render(spec):
    rng = np.random.default_rng(spec["seed"])
    bpm = spec["bpm"]
    beat = 60.0 / bpm
    bar = beat * 4
    key = NOTE[spec["key"]] + 48
    prog = spec["progression"]
    bars = spec["bars"]
    total = bars * bar + 3.0
    buf = np.zeros((int(total * SR), 2))
    sections = spec["sections"]  # list of (from_bar, set_of_parts)

    def parts_at(b):
        active = set()
        for start, parts in sections:
            if b >= start:
                active = set(parts)
        return active

    for b in range(bars):
        deg, quality = prog[b % len(prog)]
        root = key + deg
        notes = chord(root, quality)
        t0 = b * bar
        parts = parts_at(b)

        if "pad" in parts:
            n = int(bar * SR) + int(0.6 * SR)
            pad = np.zeros(n)
            for m in notes:
                pad += saw(hz(m + 12), n, detune=0.004)
            pad = lowpass(pad, spec["pad_cutoff"]) * env(n, 0.35, 0.6, "lin") * 0.16
            place(buf, pad, t0, pan=0.0)

        if "bass" in parts:
            for step, length in spec["bass_pattern"]:
                n = int(length * beat * SR)
                f = hz(root - 12)
                tone = np.sin(2 * np.pi * f * np.arange(n) / SR) + 0.25 * tri(f * 2, n)
                place(buf, tone * env(n, 0.005, length * beat * 0.9, "lin") * 0.34, t0 + step * beat)

        if "arp" in parts:
            steps = spec["arp_steps"]
            seq = notes + [notes[1] + 12, notes[2] + 12]
            for i in range(steps):
                m = seq[(i * spec["arp_stride"]) % len(seq)] + 24
                n = int(0.5 * SR)
                f = hz(m)
                pl = (tri(f, n) * 0.7 + np.sin(2 * np.pi * f * 2 * np.arange(n) / SR) * 0.3)
                pl *= env(n, 0.003, spec["arp_decay"])
                place(buf, pl * 0.11, t0 + i * (bar / steps), pan=0.35 * np.sin(i * 0.9))

        if "lead" in parts and rng.random() < 0.85:
            scale = [0, 2, 3, 5, 7, 8, 10] if quality == "min" else [0, 2, 4, 5, 7, 9, 11]
            pos = 0.0
            while pos < 4:
                length = rng.choice([0.5, 1.0, 1.5, 2.0])
                if rng.random() < 0.7:
                    m = root + 24 + scale[rng.integers(0, len(scale))]
                    n = int(min(length, 4 - pos) * beat * SR)
                    f = hz(m)
                    vib = 1 + 0.004 * np.sin(2 * np.pi * 5 * np.arange(n) / SR)
                    ph = 2 * np.pi * np.cumsum(f * vib) / SR
                    tone = np.sin(ph) + 0.3 * np.sin(2 * ph)
                    place(buf, tone * env(n, 0.04, 0.12, "lin") * 0.09, t0 + pos * beat, pan=-0.2)
                pos += length

        if "drums" in parts:
            k = kick()
            for s in spec["kick"]:
                place(buf, k, t0 + s * beat)
            for s in spec["snare"]:
                place(buf, snare(rng), t0 + s * beat, pan=0.05)
            for i in range(8):
                swing = spec.get("swing", 0) * beat * 0.5 if i % 2 else 0
                place(buf, hat(rng, open_=(i == 7 and b % 2)), t0 + i * beat * 0.5 + swing, pan=0.25)

    buf = delay(buf, beat * 0.75, 0.35, spec["delay_mix"])
    # fade in/out and soft clip
    n = len(buf)
    fade = np.ones(n)
    fi, fo = int(1.5 * SR), int(4 * SR)
    fade[:fi] = np.linspace(0, 1, fi)
    fade[-fo:] = np.linspace(1, 0, fo)
    buf *= fade[:, None]
    buf = np.tanh(buf * 1.4)
    buf /= np.max(np.abs(buf)) + 1e-9
    return (buf * 0.89 * 32767).astype(np.int16)


TRACKS = [
    {
        "file": "midnight-drive.mp3", "title": "Midnight Drive", "genre": "Synthwave", "seed": 1,
        "bpm": 96, "key": "A", "bars": 32, "pad_cutoff": 1800, "delay_mix": 0.35,
        "progression": [(0, "min"), (-4, "maj"), (-9, "maj"), (-2, "maj")],
        "bass_pattern": [(i * 0.5, 0.45) for i in range(8)],
        "arp_steps": 16, "arp_stride": 1, "arp_decay": 0.18,
        "kick": [0, 1, 2, 3], "snare": [1, 3],
        "sections": [(0, ["pad"]), (4, ["pad", "arp"]), (8, ["pad", "arp", "bass", "drums"]),
                     (16, ["pad", "arp", "bass", "drums", "lead"]), (28, ["pad", "arp"])],
    },
    {
        "file": "paper-lanterns.mp3", "title": "Paper Lanterns", "genre": "Lo-fi", "seed": 2,
        "bpm": 78, "key": "F", "bars": 24, "pad_cutoff": 1100, "delay_mix": 0.25, "swing": 0.33,
        "progression": [(0, "maj"), (4, "min"), (2, "min"), (7, "dom")],
        "bass_pattern": [(0, 1.5), (1.5, 0.5), (2.5, 1.5)],
        "arp_steps": 8, "arp_stride": 2, "arp_decay": 0.35,
        "kick": [0, 2.5], "snare": [1, 3],
        "sections": [(0, ["pad", "arp"]), (4, ["pad", "arp", "bass", "drums"]),
                     (12, ["pad", "arp", "bass", "drums", "lead"]), (21, ["pad", "arp"])],
    },
    {
        "file": "signal-bloom.mp3", "title": "Signal Bloom", "genre": "Electronic", "seed": 3,
        "bpm": 122, "key": "D", "bars": 40, "pad_cutoff": 2400, "delay_mix": 0.3,
        "progression": [(0, "min"), (0, "min"), (-2, "maj"), (-5, "sus")],
        "bass_pattern": [(i * 0.5 + 0.5, 0.4) for i in range(0, 8, 2)] + [(3.75, 0.25)],
        "arp_steps": 16, "arp_stride": 3, "arp_decay": 0.12,
        "kick": [0, 1, 2, 3], "snare": [1, 3],
        "sections": [(0, ["arp"]), (4, ["arp", "pad"]), (8, ["arp", "pad", "bass", "drums"]),
                     (24, ["arp", "pad", "bass", "drums", "lead"]), (36, ["pad", "arp"])],
    },
    {
        "file": "quiet-harbor.mp3", "title": "Quiet Harbor", "genre": "Ambient", "seed": 4,
        "bpm": 64, "key": "E", "bars": 16, "pad_cutoff": 900, "delay_mix": 0.45,
        "progression": [(0, "sus"), (5, "maj"), (-3, "min"), (5, "maj")],
        "bass_pattern": [(0, 4)],
        "arp_steps": 6, "arp_stride": 2, "arp_decay": 0.8,
        "kick": [], "snare": [],
        "sections": [(0, ["pad"]), (2, ["pad", "arp"]), (6, ["pad", "arp", "bass", "lead"]), (14, ["pad"])],
    },
    {
        "file": "copper-sky.mp3", "title": "Copper Sky", "genre": "Chillhop", "seed": 5,
        "bpm": 88, "key": "G", "bars": 28, "pad_cutoff": 1400, "delay_mix": 0.28, "swing": 0.25,
        "progression": [(0, "maj"), (-3, "min"), (5, "maj"), (2, "dom")],
        "bass_pattern": [(0, 0.75), (0.75, 0.75), (2, 1), (3.5, 0.5)],
        "arp_steps": 8, "arp_stride": 1, "arp_decay": 0.25,
        "kick": [0, 1.75, 2.5], "snare": [1, 3],
        "sections": [(0, ["pad", "bass"]), (4, ["pad", "bass", "drums", "arp"]),
                     (12, ["pad", "bass", "drums", "arp", "lead"]), (24, ["pad", "arp"])],
    },
    {
        "file": "orbit-garden.mp3", "title": "Orbit Garden", "genre": "Downtempo", "seed": 6,
        "bpm": 104, "key": "C", "bars": 32, "pad_cutoff": 2000, "delay_mix": 0.32,
        "progression": [(0, "min"), (3, "maj"), (-2, "maj"), (-4, "maj")],
        "bass_pattern": [(0, 0.5), (1, 0.5), (1.5, 0.5), (2.5, 1), (3.5, 0.5)],
        "arp_steps": 12, "arp_stride": 2, "arp_decay": 0.2,
        "kick": [0, 1.5, 2], "snare": [1, 3],
        "sections": [(0, ["pad", "arp"]), (8, ["pad", "arp", "bass", "drums"]),
                     (16, ["pad", "arp", "bass", "drums", "lead"]), (28, ["pad"])],
    },
]

ARTIST = "Shivam Singh"
ALBUM = "Waveforms (generated demos)"


def main():
    os.makedirs(OUT, exist_ok=True)
    manifest = []
    for spec in TRACKS:
        pcm = render(spec)
        with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as tmp:
            with wave.open(tmp.name, "wb") as w:
                w.setnchannels(2)
                w.setsampwidth(2)
                w.setframerate(SR)
                w.writeframes(pcm.tobytes())
            dest = os.path.join(OUT, spec["file"])
            subprocess.run(
                ["ffmpeg", "-y", "-loglevel", "error", "-i", tmp.name, "-codec:a", "libmp3lame", "-b:a", "128k",
                 "-metadata", f"title={spec['title']}", "-metadata", f"artist={ARTIST}",
                 "-metadata", f"album={ALBUM}", "-metadata", f"genre={spec['genre']}",
                 "-metadata", f"TBPM={spec['bpm']}", "-id3v2_version", "3", dest],
                check=True,
            )
        os.unlink(tmp.name)
        duration = round(len(pcm) / SR)
        manifest.append({"file": spec["file"], "title": spec["title"], "genre": spec["genre"],
                         "bpm": spec["bpm"], "key": f"{spec['key']}", "duration": duration})
        print(f"{spec['file']}: {duration}s, {os.path.getsize(dest) // 1024} KB")
    print(json.dumps(manifest, indent=2))


if __name__ == "__main__":
    main()
