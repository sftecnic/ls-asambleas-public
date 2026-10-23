export default function Brand({compact=false}:{compact?:boolean}) {
  return <div className={`brand${compact?' brand-compact':''}`}><img className="brand-symbol" src="/brand/symbol.svg" width="56" height="56" alt=""/><span className="brand-name">LS <strong>Asambleas</strong></span></div>;
}
