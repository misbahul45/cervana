import os, re, sys, json, time, statistics
from concurrent.futures import ThreadPoolExecutor
from openai import OpenAI
from pydantic import BaseModel
from langchain_openai import ChatOpenAI

KEY = os.environ["OPENAI_API_KEY"]; BASE = os.environ["OPENAI_BASE_URL"]
PRICES = {
 "gpt-4.1-mini":(0.46,1.84),"gpt-4.1-nano":(0.115,0.46),"gpt-4o-mini":(0.1725,0.69),"deepseek-v4-flash":(0.1392,0.4175),
 "qwen3.7-flash-2026-07-15":(0.0345,0.1495),"glm-5.3-flash":(0.0173,0.2875),"MiniMax-M3.1-Flash-Preview":(0.0345,0.138),
 "gemini/gemini-3.1-flash-lite":(0.2875,1.725),"seed-2-0-mini":(0.115,0.46),"qwen3.6-flash":(0.2875,1.725),"MiniMax-M2.7-highspeed":(0.0345,0.138),
 "gpt-5-nano":(0.0575,0.46),"gpt-5-mini":(0.2875,2.3),"deepseek-v4-pro":(0.8349,2.5047),"qwen3.7-plus":(0.368,1.472),"qwen3.7-max":(1.4375,4.3125),
 "gpt-5.6-luna":(0.23,1.38),"kimi-k2.6":(0.7705,3.8985),"glm-5.2":(1.2075,3.795),"MiniMax-M3":(0.345,1.38),"hy3":(0.1518,0.6072),
 "gpt-5.4-nano":(0.23,1.4375),"seed-2-0-lite":(0.2875,2.3),"mimo-v2.5":(0.161,0.322),
}
QS = [
 ("Perusahaan membayar sewa dibayar dimuka Rp 12.000.000 pada 1 Oktober untuk 12 bulan. Berapa beban sewa yang diakui sampai 31 Desember tahun yang sama?",3000000),
 ("Peralatan berharga perolehan Rp 60.000.000, umur ekonomis 5 tahun, nilai residu Rp 6.000.000, metode garis lurus. Berapa beban penyusutan per tahun?",10800000),
 ("Piutang usaha akhir periode Rp 80.000.000. Penyisihan piutang tak tertagih ditetapkan 5% dari piutang. Sebelum penyesuaian, akun penyisihan bersaldo kredit Rp 1.200.000. Berapa beban kerugian piutang pada jurnal penyesuaian?",2800000),
 ("Aset Rp 40.000.000, umur 4 tahun, tanpa nilai residu, metode saldo menurun ganda (double declining balance). Berapa beban penyusutan tahun ke-2?",10000000),
 ("Persediaan awal 50 unit @Rp 10.000, pembelian pertama 100 unit @Rp 12.000, pembelian kedua 50 unit @Rp 14.000, penjualan 120 unit. Dengan metode FIFO, berapa harga pokok penjualan?",1340000),
]

HARD = [
 ("Saldo kas menurut buku Rp 25.400.000. Cek beredar Rp 3.200.000, setoran dalam perjalanan Rp 4.500.000, biaya administrasi bank belum dicatat Rp 150.000, bunga bank belum dicatat Rp 300.000. Kesalahan pencatatan buku: sebuah cek pembayaran utang senilai Rp 1.260.000 dicatat Rp 1.620.000 (kas dikurangi). Berapa saldo kas yang benar di buku setelah penyesuaian?",25910000),
 ("Produk A: harga Rp 50.000, biaya variabel Rp 30.000, proporsi penjualan 60%. Produk B: harga Rp 80.000, biaya variabel Rp 50.000, proporsi penjualan 40%. Biaya tetap Rp 156.000.000. Berapa total unit (A dan B) pada titik impas dengan bauran penjualan tetap?",6500),
 ("Obligasi nilai nominal Rp 100.000.000, kupon 8% dibayar tiap akhir tahun, jatuh tempo 3 tahun, yield pasar 10%. Berapa harga jual obligasi, dibulatkan ke ribuan terdekat?",95026000),
 ("Mesin dibeli 1 April 2024 seharga Rp 90.000.000, umur 5 tahun, nilai residu Rp 9.000.000, garis lurus dihitung per bulan. Dijual 30 Juni 2026 seharga Rp 60.000.000. Berapa laba penjualan mesin (positif jika laba, negatif jika rugi)?",6450000),
 ("Laba akuntansi sebelum pajak Rp 200.000.000. Beda tetap: denda pajak Rp 10.000.000 tidak dapat dikurangkan. Beda waktu: penyusutan komersial Rp 30.000.000, penyusutan fiskal Rp 50.000.000. Tarif pajak 22%. Berapa beban pajak kini (pajak terutang)?",41800000),
]
if os.environ.get("QSET")=="hard":
    QS = HARD
TOL = 1000 if os.environ.get("QSET") in ("hard","harder") else 0
MAXTOK = int(os.environ.get("MAXTOK","3000"))

HARDER = [
 ("Sewa pembiayaan: pembayaran Rp 30.000.000 di akhir setiap tahun selama 4 tahun, suku bunga implisit 10%. Berapa nilai kini seluruh pembayaran sewa, dibulatkan ke ribuan terdekat?",95096000),
 ("Kontrak Rp 500.000.000, estimasi total biaya Rp 400.000.000 dan tidak berubah. Biaya tahun 1 Rp 100.000.000, biaya tahun 2 Rp 180.000.000. Dengan metode persentase penyelesaian (cost-to-cost), berapa laba kotor yang diakui pada tahun 2 saja?",45000000),
 ("Laba bersih Rp 900.000.000. Saham beredar 1 Januari 1.000.000 lembar. Pada 1 April diterbitkan 300.000 lembar. Pada 1 Oktober dibeli kembali 100.000 lembar sebagai saham treasuri. Dividen saham preferen Rp 60.000.000. Berapa laba per saham dasar (Rp per lembar)?",700),
 ("Laba bersih Rp 150.000.000; penyusutan Rp 40.000.000; piutang naik Rp 25.000.000; persediaan turun Rp 10.000.000; utang usaha naik Rp 15.000.000; laba penjualan aset Rp 8.000.000. Berapa arus kas bersih dari aktivitas operasi (metode tidak langsung)?",182000000),
 ("Persediaan awal 100 unit @Rp 5.000. Pembelian 1: 200 unit @Rp 5.600. Penjualan 150 unit. Pembelian 2: 100 unit @Rp 6.000. Penjualan 120 unit. Dengan metode rata-rata bergerak (moving average), berapa nilai persediaan akhir?",733200),
]
if os.environ.get("QSET")=="harder":
    QS = HARDER
REPEAT = int(os.environ.get("REPEAT","1"))
SUFFIX = "\nJawab singkat. Akhiri dengan satu baris: JAWABAN: <angka tanpa titik atau koma>"

def parse(text):
    m = re.findall(r"JAWABAN:\s*(?:Rp\.?\s*)?([\d\.\,]+)", text or "")
    if not m: return None
    v = re.sub(r"[.,]", "", m[-1]); return int(v) if v.isdigit() else None

client = OpenAI(api_key=KEY, base_url=BASE, timeout=150)

def ask(model, q):
    t0 = time.time(); first = None; first_reason = None; text = ""; usage = None; reasoning_chars = 0
    for kw in ({"max_tokens":MAXTOK},{"max_completion_tokens":MAXTOK}):
        try:
            stream = client.chat.completions.create(model=model, messages=[{"role":"user","content":q+SUFFIX}], stream=True, stream_options={"include_usage":True}, **kw)
            for ch in stream:
                if getattr(ch,"usage",None): usage = ch.usage
                if not ch.choices: continue
                d = ch.choices[0].delta
                rc = getattr(d,"reasoning_content",None) or (d.model_extra or {}).get("reasoning_content") if hasattr(d,"model_extra") else None
                if rc:
                    reasoning_chars += len(rc)
                    if first_reason is None: first_reason = time.time()-t0
                if d.content:
                    if first is None: first = time.time()-t0
                    text += d.content
            return dict(ok=True, text=text, total=time.time()-t0, ttfa=first, ttfr=first_reason, usage=usage, reasoning_chars=reasoning_chars)
        except Exception as e:
            err = str(e)[:160]
            if "max_tokens" in err or "max_completion_tokens" in err: continue
            return dict(ok=False, err=err)
    return dict(ok=False, err=err)

class Q(BaseModel):
    question: str
    options: list[str]
    answer_index: int

def structured(model):
    res = {}
    for method in ("json_schema","function_calling"):
        try:
            llm = ChatOpenAI(model=model, api_key=KEY, base_url=BASE, max_tokens=MAXTOK, timeout=150).with_structured_output(Q, method=method)
            out = llm.invoke("Buat satu soal pilihan ganda (4 opsi) tentang persamaan dasar akuntansi.")
            res[method] = bool(out and len(out.options)==4 and 0 <= out.answer_index < 4)
        except Exception as e:
            res[method] = False
    return res

def run(model):
    rows = [ask(model,q) for _ in range(REPEAT) for q,_ in QS]
    correct = sum(1 for r,(_,ans) in zip(rows,QS*REPEAT) if r.get("ok") and (lambda v: v is not None and abs(v-ans)<=TOL)(parse(r["text"])))
    errs = [r["err"] for r in rows if not r.get("ok")]
    oks = [r for r in rows if r.get("ok")]
    pin, pout = PRICES.get(model,(None,None))
    tin = sum((r["usage"].prompt_tokens if r["usage"] else 0) for r in oks); tout = sum((r["usage"].completion_tokens if r["usage"] else 0) for r in oks)
    reas = 0
    for r in oks:
        u=r["usage"]
        if u and getattr(u,"completion_tokens_details",None) and getattr(u.completion_tokens_details,"reasoning_tokens",None): reas += u.completion_tokens_details.reasoning_tokens
    cost = (tin*pin + tout*pout)/1e6 if pin is not None else None
    sm = structured(model)
    return dict(model=model, correct=correct, n=len(QS)*REPEAT, errs=errs[:1],
        med_total=round(statistics.median([r["total"] for r in oks]),1) if oks else None,
        med_ttfa=round(statistics.median([r["ttfa"] for r in oks if r["ttfa"]]),1) if any(r["ttfa"] for r in oks) else None,
        tok_out=tout, reasoning_tokens=reas, reasoning_stream=any(r["reasoning_chars"] for r in oks), cost_5q=round(cost,5) if cost is not None else None, structured=sm)

if __name__ == "__main__":
    models = sys.argv[1:]
    with ThreadPoolExecutor(max_workers=5) as ex:
        results = list(ex.map(run, models))
    json.dump(results, open(os.environ["OUT"],"w"), indent=1)
    for r in results:
        print(f"{r['model']:32s} {r['correct']}/{r['n']}  total {r['med_total']}s  ttfa {r['med_ttfa']}s  out {r['tok_out']:5d}  reason {r['reasoning_tokens']:5d}  cost5q ${r['cost_5q']}  struct js={r['structured'].get('json_schema')} fc={r['structured'].get('function_calling')}  {r['errs'] or ''}")
