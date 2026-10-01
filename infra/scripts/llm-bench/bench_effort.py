import os, sys, time, json
from concurrent.futures import ThreadPoolExecutor
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from bench_quiz import QuizResponse, PROMPT, PRICES
from openai import OpenAI
KEY=os.environ["OPENAI_API_KEY"]; BASE=os.environ["OPENAI_BASE_URL"]
c=OpenAI(api_key=KEY,base_url=BASE,timeout=200)
def one(cfg):
    model,effort=cfg
    kw={"max_completion_tokens":12000}
    if effort: kw["reasoning_effort"]=effort
    t0=time.time()
    try:
        r=c.chat.completions.create(model=model,messages=[{"role":"user","content":PROMPT+"\nJawab hanya JSON: {\"quiz\":[{question,type,difficulty,options,answer}]}"}],**kw)
    except Exception as e:
        return dict(model=model,effort=effort,err=str(e)[:130])
    u=r.usage; pin,pout=PRICES.get(model,(0,0))
    reas=getattr(getattr(u,"completion_tokens_details",None),"reasoning_tokens",0) or 0
    return dict(model=model,effort=effort,sec=round(time.time()-t0,1),inp=u.prompt_tokens,out=u.completion_tokens,reasoning=reas,cost=round((u.prompt_tokens*pin+u.completion_tokens*pout)/1e6,5))
cfgs=[("gpt-5-mini",None),("gpt-5-mini","low"),("gpt-5-mini","minimal"),("gpt-5-nano",None),("gpt-5-nano","low"),("gpt-5-nano","minimal"),("deepseek-v4-flash",None),("deepseek-v4-flash","low"),("gemini/gemini-3.1-flash-lite",None)]
with ThreadPoolExecutor(max_workers=5) as ex: rs=list(ex.map(one,cfgs))
for r in rs: print(r)
