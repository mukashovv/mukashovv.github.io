"use strict";
const Finance = (() => {
  const config = window.SUPER_TABLE_CONFIG;
  const localKey = "super-table.preview.v1";
  let client, account, local;
  const pad = n => String(n).padStart(2, "0");
  function monthKey(date = new Date()) { return date.getFullYear() + "-" + pad(date.getMonth() + 1); }
  function dateKey(date = new Date()) { return monthKey(date) + "-" + pad(date.getDate()); }
  function dateOf(key) { const [y,m] = key.split("-").map(Number); return new Date(y,m-1,1,12); }
  function nextMonth(key, offset) { const d=dateOf(key); d.setMonth(d.getMonth()+offset); return monthKey(d); }
  function emptyMonth(goals) {
    return { entries: [], goals: goals || [{name:"Подушка", rate:20}] };
  }
  function totals(data) {
    const sums = {income:0,expense:0,net:0};
    for (const entry of data.entries) { sums.income += entry.income; sums.expense += entry.expense; }
    sums.net = sums.income - sums.expense;
    return sums;
  }
  function allocated(net,rate) { return Math.round(net * rate / 100); }
  function balance(debt) {
    return debt.principal + debt.interest - debt.payments.reduce((sum,p) => sum + (p.done ? p.amount : 0),0);
  }
  function installments(debt, from, through) {
    const plan = debt.schedule;
    const recurring = debt.type === "recurring";
    let remaining = recurring ? Infinity : balance(debt);
    if (!plan || debt.closed || remaining <= 0) return [];
    const paid = new Map();
    for (const payment of debt.payments) {
      if (payment.done && payment.period) paid.set(payment.period, (paid.get(payment.period) || 0) + payment.amount);
    }
    const firstPeriod = plan.firstDate.slice(0,7);
    const start = dateOf(recurring && from && from > firstPeriod ? from : firstPeriod);
    if (recurring && !through) {
      let latest = monthKey();
      for (const period of paid.keys()) if (period > latest) latest = period;
      through = nextMonth(latest > firstPeriod ? latest : firstPeriod, 1);
    }
    const day = Number(plan.firstDate.slice(-2));
    const items = [];
    for (let i = 0; (recurring || i < plan.months) && remaining > 0; i++) {
      const due = new Date(start.getFullYear(), start.getMonth() + i + 1, 0, 12);
      due.setDate(Math.min(day, due.getDate()));
      const period = monthKey(due);
      if (recurring && (due.getFullYear() > 9999 || period > through)) break;
      const amount = Math.min(remaining, plan.amount - (paid.get(period) || 0));
      if (amount <= 0) continue;
      const dueDate = dateKey(due);
      due.setDate(due.getDate() - 4);
      items.push({period, dueDate, reminder:dateKey(due), amount});
      remaining -= amount;
    }
    return items;
  }
  function readLocal() { const raw=localStorage.getItem(localKey); return raw ? JSON.parse(raw) : null; }
  function startLocal() {
    local = true; account = null;
    let book = readLocal();
    if (!book) {
      book = {paid:false,trial:monthKey(),months:{},debts:{}};
      book.months[book.trial]={rev:1,data:emptyMonth()};
      localStorage.setItem(localKey,JSON.stringify(book));
    }
    return book;
  }
  const configured = Boolean(config.supabaseUrl && config.supabasePublishableKey);
  async function connect() {
    if (!client) {
      const {createClient}=await import("https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.49.8/+esm");
      client=createClient(config.supabaseUrl, config.supabasePublishableKey, {auth:{storageKey:"super-table.auth.v1"}});
    }
    return client;
  }
  async function rpc(name, params) {
    const {data,error}=await client.rpc(name,params);
    if(error) throw new Error(error.message);
    return data;
  }
  async function load() { return local ? readLocal() : rpc("st_book",{p_month:monthKey()}); }
  async function openSession() {
    await connect();
    const {data,error}=await client.auth.getSession();
    if(error) throw error;
    account=data.session?.user || null;
    local=false;
    return account;
  }
  function observeSession(fn) { client.auth.onAuthStateChange((event,session)=>{
    const changed = account?.id !== session?.user?.id;
    account=session?.user || null;
    if(changed && !local) setTimeout(()=>fn(account),0);
  }); }
  async function authenticate(mode,email,password) {
    await connect();
    const result=mode==="login" ? await client.auth.signInWithPassword({email,password}) :
      await client.auth.signUp({email,password,options:{emailRedirectTo:location.origin+location.pathname}});
    if(result.error) throw result.error;
    account=result.data.session?.user || null; local=false;
    return Boolean(account);
  }
  async function leave() {
    if (!local && client) { const {error}=await client.auth.signOut({scope:"local"}); if(error) throw error; }
    local=false; account=null;
  }
  async function save(kind,key,rev,data) {
    if(!local) return rpc("st_save",{p_kind:kind,p_key:key,p_revision:rev,p_data:data});
    const write = () => {
      const b=readLocal();
      if(kind==="months" && !b.paid && key!==b.trial) throw new Error("MONTH_LIMIT");
      if((b[kind][key]?.rev || 0)!==rev) throw new Error("STALE_VERSION");
      const record={rev:rev+1,data};
      b[kind][key]=record;
      localStorage.setItem(localKey,JSON.stringify(b));
      return record;
    };
    return navigator.locks ? navigator.locks.request(localKey,write) : write();
  }
  async function members(offset){return rpc("st_members",{p_offset:offset});}
  async function deleteDebt(key, rev) {
    if (!local) return rpc("st_delete_debt", {p_key:key, p_revision:rev});
    const write = () => {
      const b = readLocal();
      if (b.debts[key]?.rev !== rev) throw new Error("STALE_VERSION");
      delete b.debts[key];
      localStorage.setItem(localKey, JSON.stringify(b));
    };
    return navigator.locks ? navigator.locks.request(localKey, write) : write();
  }
  async function grantMember(member,years){return rpc("st_grant_member",{p_member:member,p_years:years});}
  return {configured, members, grantMember, startLocal, load, openSession, observeSession, authenticate, leave, save, deleteDebt,
    monthKey,dateKey,dateOf,nextMonth,emptyMonth,totals,allocated,balance,installments,
    get local(){return local;},get email(){return account?.email || "";}};
})();
