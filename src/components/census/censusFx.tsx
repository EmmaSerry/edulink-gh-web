import { useEffect, useState } from "react";

/**
 * Glass, glow and motion for the census screens. The styles are injected here so
 * no other stylesheet has to change. Everything respects "reduce motion".
 */
const CSS = `
@keyframes cxRise{from{opacity:0;transform:translateY(18px) scale(.98)}to{opacity:1;transform:none}}
@keyframes cxFloat{0%,100%{transform:translate3d(0,0,0) scale(1)}50%{transform:translate3d(30px,-24px,0) scale(1.12)}}
@keyframes cxFloat2{0%,100%{transform:translate3d(0,0,0) scale(1)}50%{transform:translate3d(-36px,26px,0) scale(1.1)}}
@keyframes cxShine{0%{background-position:-220% 0}100%{background-position:220% 0}}
@keyframes cxPulse{0%,100%{box-shadow:0 0 0 0 rgba(28,111,235,.0)}50%{box-shadow:0 0 22px 2px rgba(28,111,235,.28)}}
@keyframes cxGrad{0%{background-position:0% 50%}50%{background-position:100% 50%}100%{background-position:0% 50%}}
@keyframes cxDraw{from{stroke-dashoffset:1}to{stroke-dashoffset:0}}
@keyframes cxFade{from{opacity:0}to{opacity:1}}
@keyframes cxPop{from{opacity:0;transform:scale(0)}to{opacity:1;transform:scale(1)}}
@keyframes cxBlink{0%,100%{box-shadow:0 0 0 0 rgba(220,53,69,.55)}50%{box-shadow:0 0 0 7px rgba(220,53,69,0)}}
.cx-line{stroke-dasharray:1;stroke-dashoffset:1;animation:cxDraw 1.7s cubic-bezier(.3,.7,.2,1) forwards}
.cx-area{opacity:0;animation:cxFade 1s ease .9s forwards}
.cx-dot{opacity:0;transform-box:fill-box;transform-origin:center;animation:cxPop .4s ease forwards}
.cx-owing{animation:cxBlink 2.2s ease-in-out infinite}
@keyframes cxDrawIn{from{opacity:0;transform:scale(.7)}to{opacity:1;transform:none}}

.cx-wrap{position:relative;isolation:isolate}
.cx-aurora{position:absolute;inset:-10px -10px auto -10px;height:520px;z-index:-1;overflow:hidden;pointer-events:none;border-radius:24px}
.cx-aurora i{position:absolute;border-radius:50%;filter:blur(70px);opacity:.5}
.cx-aurora i:nth-child(1){width:360px;height:360px;left:-40px;top:-80px;background:#1c6feb;animation:cxFloat 14s ease-in-out infinite}
.cx-aurora i:nth-child(2){width:320px;height:320px;left:38%;top:-120px;background:#e64a9b;opacity:.35;animation:cxFloat2 17s ease-in-out infinite}
.cx-aurora i:nth-child(3){width:340px;height:340px;right:-60px;top:-60px;background:#f0a500;opacity:.3;animation:cxFloat 19s ease-in-out infinite}
.cx-aurora i:nth-child(4){width:280px;height:280px;left:20%;top:160px;background:#16a3b8;opacity:.28;animation:cxFloat2 21s ease-in-out infinite}

.cx-hero{position:relative;border-radius:20px;padding:20px 24px;margin-bottom:18px;color:#fff;overflow:hidden;
  background:linear-gradient(120deg,rgba(10,31,68,.88),rgba(28,111,235,.82),rgba(122,92,250,.8),rgba(230,74,155,.75));
  background-size:260% 260%;animation:cxGrad 14s ease infinite;
  border:1px solid rgba(255,255,255,.28);box-shadow:0 18px 50px rgba(10,31,68,.28),inset 0 1px 0 rgba(255,255,255,.35);backdrop-filter:blur(10px)}
.cx-hero:before{content:"";position:absolute;inset:0;background:linear-gradient(105deg,transparent 35%,rgba(255,255,255,.28) 50%,transparent 65%);
  background-size:220% 100%;animation:cxShine 6.5s linear infinite;pointer-events:none}
.cx-hero h1{color:#fff;text-shadow:0 2px 14px rgba(0,0,0,.25)}
.cx-hero .text-muted{color:rgba(255,255,255,.86)!important}

.cx-glass{background:linear-gradient(145deg,rgba(255,255,255,.2),rgba(255,255,255,.06));
  -webkit-backdrop-filter:blur(16px) saturate(150%);backdrop-filter:blur(16px) saturate(150%);
  border:1px solid rgba(255,255,255,.3)!important;border-radius:18px!important;
  box-shadow:0 10px 34px rgba(10,31,68,.16),inset 0 1px 0 rgba(255,255,255,.4);
  transition:transform .3s cubic-bezier(.2,.8,.2,1),box-shadow .3s,border-color .3s}
.cx-glass:hover{transform:translateY(-4px);box-shadow:0 18px 44px rgba(28,111,235,.28),inset 0 1px 0 rgba(255,255,255,.55);border-color:rgba(255,255,255,.55)!important}
.cx-rise{opacity:0;animation:cxRise .7s cubic-bezier(.2,.8,.2,1) forwards;animation-delay:calc(var(--i,0) * 70ms)}
.cx-kpi{position:relative;overflow:hidden}
.cx-kpi:after{content:"";position:absolute;right:-24px;top:-24px;width:90px;height:90px;border-radius:50%;background:var(--glow,#1c6feb);opacity:.28;filter:blur(18px)}
.cx-num{font-weight:800;font-variant-numeric:tabular-nums;
  background:linear-gradient(90deg,#1c6feb,#7a5cfa,#e64a9b,#1c6feb);background-size:250% 100%;
  -webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent;color:transparent;
  animation:cxGrad 6s ease infinite;text-shadow:0 0 22px rgba(122,92,250,.25)}
.cx-title{font-weight:700;display:flex;align-items:center;gap:8px}
.cx-title:before{content:"";width:9px;height:9px;border-radius:50%;background:linear-gradient(135deg,#1c6feb,#e64a9b);box-shadow:0 0 12px rgba(230,74,155,.7)}
.cx-pills .nav-link{border-radius:999px;backdrop-filter:blur(8px);background:rgba(255,255,255,.1);border:1px solid rgba(255,255,255,.2);margin-right:6px;transition:all .25s}
.cx-pills .nav-link:hover{transform:translateY(-2px);box-shadow:0 8px 20px rgba(28,111,235,.25)}
.cx-pills .nav-link.active{background:linear-gradient(120deg,#1c6feb,#7a5cfa,#e64a9b);background-size:200% 100%;animation:cxGrad 8s ease infinite;color:#fff;border-color:transparent;box-shadow:0 8px 26px rgba(122,92,250,.45)}
.cx-chip{display:inline-flex;align-items:center;gap:6px;border-radius:999px;padding:5px 13px;cursor:pointer;user-select:none;font-size:.85rem;font-weight:600;
  background:rgba(255,255,255,.12);border:1px solid rgba(255,255,255,.28);transition:all .25s}
.cx-chip:hover{transform:translateY(-2px)}
.cx-chip.on{background:linear-gradient(120deg,rgba(28,111,235,.9),rgba(122,92,250,.9));color:#fff;border-color:transparent;box-shadow:0 6px 20px rgba(28,111,235,.4)}
.cx-chip.off{opacity:.65;text-decoration:line-through}
.cx-live{animation:cxPulse 3s ease-in-out infinite}
.cx-bar{transition:width 1.1s cubic-bezier(.2,.8,.2,1);box-shadow:0 0 12px var(--glow,rgba(28,111,235,.55))}
.cx-slice{transition:stroke-dasharray 1.2s cubic-bezier(.2,.8,.2,1);filter:drop-shadow(0 0 5px var(--glow,rgba(28,111,235,.5)))}
.cx-col{transition:transform 1s cubic-bezier(.2,.8,.2,1);transform-box:fill-box;transform-origin:bottom;filter:drop-shadow(0 0 4px var(--glow,rgba(28,111,235,.45)))}
.cx-col:hover{filter:brightness(1.2) drop-shadow(0 0 8px var(--glow,rgba(28,111,235,.8)))}
.cx-donut{animation:cxDrawIn .9s cubic-bezier(.2,.8,.2,1) both}
@media (prefers-reduced-motion: reduce){
  .cx-rise,.cx-hero,.cx-hero:before,.cx-aurora i,.cx-num,.cx-live,.cx-donut,.cx-pills .nav-link.active{animation:none!important;opacity:1}
  .cx-bar,.cx-slice,.cx-col,.cx-glass{transition:none!important}
  .cx-line{stroke-dashoffset:0!important}.cx-area,.cx-dot{opacity:1!important}.cx-owing{animation:none!important}
}

/* ---- readability: strong text in light AND dark mode (inherits the app's own text colour) ---- */
.cx-wrap{font-size:1.02rem}
.cx-wrap .text-muted,.cx-wrap .small,.cx-wrap small,.cx-wrap label{color:inherit!important;opacity:1!important}
.cx-wrap .text-muted{font-weight:500}
.cx-wrap .form-control,.cx-wrap .form-select{color:inherit!important;font-weight:500;border-width:1.5px;background-color:rgba(127,127,127,.14)}
.cx-wrap .form-control::placeholder{color:inherit!important;opacity:.8!important}
.cx-wrap .form-select option{color:#111;background:#fff}
.cx-wrap .btn-outline-primary{color:inherit!important;font-weight:600;border:1.5px solid #4c8dff!important;background:rgba(76,141,255,.16)!important}
.cx-wrap .btn-outline-primary:hover{background:linear-gradient(120deg,#1c6feb,#7a5cfa)!important;color:#fff!important}
.cx-wrap .cx-chip{color:inherit;font-weight:700;font-size:.92rem;background:rgba(127,127,127,.16);border:1.5px solid rgba(127,127,127,.55)}
.cx-wrap .cx-chip.on{color:#fff}
.cx-wrap .cx-chip.off{opacity:.9}
.cx-wrap .cx-pills .nav-link{color:inherit!important;font-weight:700;font-size:1.02rem;background:rgba(127,127,127,.16);border:1.5px solid rgba(127,127,127,.5)}
.cx-wrap .cx-pills .nav-link.active{color:#fff!important}
.cx-wrap .cx-hero,.cx-wrap .cx-hero h1,.cx-wrap .cx-hero h2,.cx-wrap .cx-hero p,.cx-wrap .cx-hero div,.cx-wrap .cx-hero span,.cx-wrap .cx-hero .text-muted{color:#fff!important;opacity:1!important}
.cx-wrap .cx-hero{background:linear-gradient(120deg,#0a1f44,#1c4fd0,#5b3fd6,#b02f78)!important;background-size:260% 260%}
.cx-wrap .cx-hero p,.cx-wrap .cx-hero .text-muted{font-size:1.05rem;font-weight:500;text-shadow:0 1px 6px rgba(0,0,0,.4)}
.cx-wrap .cx-hero .btn{color:#0a1f44!important;background:#fff!important;font-weight:700}
.cx-wrap .cx-glass{background:linear-gradient(145deg,rgba(127,127,127,.2),rgba(127,127,127,.08))}
.cx-wrap .cx-title{font-size:1.08rem}
.cx-wrap table td,.cx-wrap table th{font-size:.95rem}
.cx-tip{position:fixed;z-index:2000;pointer-events:none;min-width:170px;max-width:260px;background:#0a1f44;color:#fff;border:1.5px solid rgba(255,255,255,.55);border-radius:10px;padding:8px 11px;font-size:.9rem;line-height:1.5;box-shadow:0 10px 30px rgba(0,0,0,.45)}
.cx-tip-t{font-weight:800;margin-bottom:2px;display:flex;align-items:center;gap:7px}
.cx-tip-t span{width:11px;height:11px;border-radius:3px;display:inline-block}
.cx-row{border-radius:6px;transition:background .15s}
.cx-row:hover{background:rgba(127,127,127,.18)}
.cx-slice{cursor:pointer}.cx-slice:hover{stroke-width:27px}
.cx-wrap .cx-pills .nav-link.active{background:linear-gradient(120deg,#1c6feb,#7a5cfa,#e64a9b)!important;background-size:200% 100%;color:#fff!important;border:2px solid #fff!important;box-shadow:0 0 0 3px rgba(122,92,250,.55),0 10px 26px rgba(122,92,250,.55)!important;transform:translateY(-2px);font-weight:800}
.cx-wrap .cx-pills .nav-link.active:after{content:"";display:block;height:3px;border-radius:3px;background:#ffe08a;margin-top:3px}
@media print{.cx-aurora{display:none}.cx-tip{display:none}}
`;

export function CensusFx() {
  return <style>{CSS}</style>;
}

export function Aurora() {
  return (
    <div className="cx-aurora" aria-hidden="true">
      <i /><i /><i /><i />
    </div>
  );
}

/** true shortly after mount and again whenever `sig` changes, so charts can grow in. */
export function useReveal(sig: string): boolean {
  const [on, setOn] = useState(false);
  useEffect(() => {
    setOn(false);
    const id = window.requestAnimationFrame(() => window.requestAnimationFrame(() => setOn(true)));
    return () => window.cancelAnimationFrame(id);
  }, [sig]);
  return on;
}

/** A number that counts up to its value. */
export function Count({ value, decimals = 0, suffix = "", className = "cx-num" }: { value: number; decimals?: number; suffix?: string; className?: string }) {
  const [shown, setShown] = useState(0);
  useEffect(() => {
    const reduce = typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce || !Number.isFinite(value)) {
      setShown(value);
      return;
    }
    let raf = 0;
    const start = performance.now();
    const dur = 1200;
    const from = 0;
    const tick = (t: number) => {
      const p = Math.min(1, (t - start) / dur);
      const e = 1 - Math.pow(1 - p, 4);
      setShown(from + (value - from) * e);
      if (p < 1) raf = window.requestAnimationFrame(tick);
    };
    raf = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(raf);
  }, [value]);
  return (
    <span className={className}>
      {shown.toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}
      {suffix}
    </span>
  );
}
