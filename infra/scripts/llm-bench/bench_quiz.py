import os, re, sys, json, time
from concurrent.futures import ThreadPoolExecutor
from typing import List, Optional, Literal
from pydantic import BaseModel
from langchain_openai import ChatOpenAI

KEY=os.environ["OPENAI_API_KEY"]; BASE=os.environ["OPENAI_BASE_URL"]
PRICES={"gemini/gemini-3.1-flash-lite":(0.2875,1.725),"gpt-5-nano":(0.0575,0.46),"deepseek-v4-flash":(0.1392,0.4175),"gpt-5.6-luna":(0.23,1.38),"gpt-5-mini":(0.2875,2.3),"deepseek-v4-pro":(0.8349,2.5047),"gpt-4.1-mini":(0.46,1.84)}

class QuizItem(BaseModel):
    question: str
    type: Literal["multiple_choice","input","matching","scenario"]
    difficulty: Literal["easy","medium","hard","hots"]
    options: Optional[List[str]] = None
    answer: Optional[str] = None
class QuizResponse(BaseModel):
    quiz: List[QuizItem]

PROMPT = """Anda adalah dosen akuntansi yang menyusun soal untuk mahasiswa.
Materi: Jurnal Penyesuaian (beban dibayar dimuka, pendapatan diterima dimuka, beban yang masih harus dibayar, penyusutan garis lurus, penyisihan piutang tak tertagih).
Buat 5 soal: 2 easy (konsep), 2 medium (perhitungan dengan angka pasti dan satu jawaban benar), 1 hots (kasus yang menuntut analisis).
Aturan: setiap `question` self-contained; soal multiple_choice memiliki 4 opsi dan tepat satu jawaban benar; `answer` berisi teks opsi yang benar (atau rubrik singkat untuk scenario/input); bahasa Indonesia baku. Output JSON sesuai skema."""

JUDGE = """Anda auditor soal akuntansi yang teliti. Hitung sendiri jawaban benar setiap soal, lalu nilai kualitas set soal berikut.
Kembalikan HANYA JSON: {"items":[{"answer_correct":true|false,"exactly_one_valid_option":true|false|null}],"language_1to5":int,"issues":"ringkas"}
SOAL:
"""

def gen(model):
    llm = ChatOpenAI(model=model, api_key=KEY, base_url=BASE, max_tokens=8000, timeout=180).with_structured_output(QuizResponse)
    t0=time.time()
    try:
        out = llm.invoke([{"role":"user","content":PROMPT}])
        return dict(ok=True, quiz=out.model_dump() if hasattr(out,"model_dump") else out, sec=round(time.time()-t0,1))
    except Exception as e:
        return dict(ok=False, err=str(e)[:150], sec=round(time.time()-t0,1))

def judge(quiz):
    llm = ChatOpenAI(model="claude-sonnet-5", api_key=KEY, base_url=BASE, max_tokens=3000, timeout=180)
    r = llm.invoke([{"role":"user","content":JUDGE+json.dumps(quiz,ensure_ascii=False)}])
    m = re.search(r"\{.*\}", r.content, re.S)
    return json.loads(m.group(0))

def run(args):
    model, rep = args
    g = gen(model)
    if not g["ok"]: return dict(model=model, rep=rep, ok=False, err=g["err"], sec=g["sec"])
    n = len(g["quiz"]["quiz"])
    try: j = judge(g["quiz"])
    except Exception as e: return dict(model=model, rep=rep, ok=True, n=n, sec=g["sec"], judge_err=str(e)[:100])
    items = j.get("items",[])
    ok_keys = sum(1 for i in items if i.get("answer_correct"))
    return dict(model=model, rep=rep, ok=True, n=n, sec=g["sec"], keys_ok=ok_keys, of=len(items), lang=j.get("language_1to5"), issues=(j.get("issues") or "")[:140])

if __name__=="__main__":
    models=sys.argv[1:]
    jobs=[(m,r) for m in models for r in (1,2)]
    with ThreadPoolExecutor(max_workers=6) as ex:
        res=list(ex.map(run,jobs))
    json.dump(res,open(os.environ["OUT"],"w"),indent=1,ensure_ascii=False)
    for r in res:
        if not r["ok"]: print(f"{r['model']:30s} r{r['rep']} FAILED {r['sec']}s {r['err']}"); continue
        print(f"{r['model']:30s} r{r['rep']} n={r.get('n')} keys {r.get('keys_ok')}/{r.get('of')} lang {r.get('lang')} {r['sec']}s  {r.get('issues','')}")
