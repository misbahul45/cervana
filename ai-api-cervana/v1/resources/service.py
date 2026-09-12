import os
import subprocess
import shutil
import logging
import functools
from io import BytesIO
from urllib.parse import urlparse, parse_qs

import requests
import pdfplumber
import whisper
from youtube_transcript_api import YouTubeTranscriptApi

from config.envs import ENVS
from v1.resources.dto import ResourceBase, ResourceBody


def get_resource(id: str, token: str) -> ResourceBase:
    url = f"{ENVS['NEST_API']}/material/resources/{id}"
    headers = {"Authorization": f"Bearer {token}"}
    logging.info(f"[RESOURCE][GET] {url}")

    res = requests.get(url, headers=headers, timeout=15)


    res.raise_for_status()
    data = res.json()["data"]
    return ResourceBase(**data)


def callback_resource(id: str, token: str, body: ResourceBody | None = None):
    url = f"{ENVS['NEST_API']}/material/resources/callback"

    params = {}
    if body and "type_worker" in body:
        params["type"] = body["type_worker"]

    payload = {"resourceId": id}
    if body:
        payload.update(body)

    headers = {"Authorization": f"Bearer {token}"}

    logging.info(f"[CALLBACK][{id}] Sending data")

    try:
        res = requests.post(url, headers=headers, json=payload, params=params, timeout=15)
        res.raise_for_status()
        return res.status_code

    except requests.RequestException as e:
        logging.error(f"[CALLBACK][{id}] Failed: {e}")
        raise


def get_content(id: str, token: str):
    url = f"{ENVS['NEST_API']}/contents/{id}"
    headers = {"Authorization": f"Bearer {token}"}
    logging.info(f"[CONTENT][GET] {url}")

    res = requests.get(url, headers=headers, timeout=15)
    res.raise_for_status()
    return res.json()["data"]


def get_video_id(url: str):
    p = urlparse(url)
    if p.hostname == "youtu.be":
        return p.path[1:]
    if p.hostname in ("www.youtube.com", "youtube.com"):
        return parse_qs(p.query).get("v", [None])[0]
    return None


def download_audio(url: str, output_path="audio.wav"):
    if not shutil.which("yt-dlp"):
        raise EnvironmentError("yt-dlp not found. Install it with `pip install yt-dlp`.")
    try:
        subprocess.run(["yt-dlp", "-x", "--audio-format", "wav", "-o", output_path, url], check=True)
        return output_path if os.path.exists(output_path) else None
    except subprocess.CalledProcessError:
        return None


@functools.lru_cache(maxsize=1)
def get_whisper_model(model_size="tiny"):
    return whisper.load_model(model_size)


def transcribe_with_whisper(audio_path: str, model_size="tiny") -> str:
    model = get_whisper_model(model_size)
    return " ".join(model.transcribe(audio_path)["text"].split())


def get_yt_transcript(url: str, languages: list[str] = ["en", "id"]) -> str | None:
    video_id = get_video_id(url)
    if not video_id:
        return None
    try:
        transcripts = YouTubeTranscriptApi.list_transcripts(video_id)  # pylint: disable=no-member
        for t in transcripts:
            if t.language_code in languages:
                text = " ".join(x["text"] for x in t.fetch())
                return " ".join(text.split())
    except Exception:
        pass
    audio = download_audio(url)
    if audio and os.path.exists(audio):
        text = transcribe_with_whisper(audio)
        os.remove(audio)
        return text
    return None


def extract_pdf(url: str) -> str | None:
    try:
        response = requests.get(url.strip(), timeout=20)
        response.raise_for_status()
        text = ""
        with pdfplumber.open(BytesIO(response.content)) as pdf:
            for page in pdf.pages:
                page_text = page.extract_text()
                if page_text:
                    text += page_text + "\n"
        return text
    except Exception as e:
        logging.error(f"[PDF][EXTRACT] Failed to extract {url}: {e}")
        return None
