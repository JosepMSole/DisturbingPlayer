(() => {
  "use strict";

  const MANIFEST_URL = "music/manifest.json";

  const skin = document.getElementById("skin");
  const audio = document.getElementById("audio");

  const ovTime = document.getElementById("ovTime");
  const ovTrack = document.getElementById("ovTrack");
  const ovCounter = document.getElementById("ovCounter");
  const ovProg = document.getElementById("ovProg");
  const ovProgFill = document.getElementById("ovProgFill");
  const ovList = document.getElementById("ovList");

  const ovWave = document.getElementById("ovWave");
  const ovShuffle = document.getElementById("ovShuffle");
  const ovPlayIcon = document.getElementById("ovPlayIcon");

  const volMute = document.getElementById("volMute");
  const volSlider = document.getElementById("volSlider");

  const hitPrev = document.getElementById("hitPrev");
  const hitPlay = document.getElementById("hitPlay");
  const hitNext = document.getElementById("hitNext");
  const hitShuffle = document.getElementById("hitShuffle");

  const localLoad = document.getElementById("localLoad");
  const pickFolder = document.getElementById("pickFolder");
  const pickFiles = document.getElementById("pickFiles");

  let tracks = []; // {name, src, file?}
  let idx = 0;
  let shuffle = false;

  // ==== WAVEFORM ANALYSER ====
  let ac = null, analyser = null, srcNode = null, waveData = null;
  const waveCtx = ovWave?.getContext("2d", { alpha: true });

  // playlist total duration (seconds)
  let playlistTotalSec = null;

  function fmt(sec){
    if (!Number.isFinite(sec)) return "0:00";
    const m = Math.floor(sec/60);
    const s = Math.floor(sec%60);
    return `${m}:${String(s).padStart(2,"0")}`;
  }
  function fmtLong(sec){
    if (!Number.isFinite(sec)) return "0:00";
    sec = Math.max(0, Math.floor(sec));
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    const s = sec % 60;
    if (h > 0) return `${h}:${String(m).padStart(2,"0")}:${String(s).padStart(2,"0")}`;
    return `${m}:${String(s).padStart(2,"0")}`;
  }
  function stripMp3(n){ return (n||"—").replace(/\.mp3$/i,""); }
  function baseName(path){
    const f = (path.split("/").pop() || path);
    return stripMp3(decodeURIComponent(f));
  }

  function setTrackName(name){
    ovTrack.textContent = name || "—";
    ovTrack.setAttribute("data-text", name || "—");
    document.title = `DISTURBING PLAYER${name ? " — " + name : ""}`;
  }

  function renderList(){
    ovList.innerHTML = "";
    tracks.forEach((t,i)=>{
      const row = document.createElement("div");
      row.className = "item" + (i===idx ? " active" : "");
      row.innerHTML = `<div class="name">${t.name}</div><div class="num">${String(i+1).padStart(2,"0")}</div>`;
      row.addEventListener("click", ()=>{ idx=i; renderList(); });
      row.addEventListener("dblclick", ()=> playIndex(i,true));
      ovList.appendChild(row);
    });
  }

  function nextIndex(dir){
    if (!tracks.length) return 0;
    if (shuffle){
      if (tracks.length === 1) return idx;
      let n = idx;
      while (n===idx) n = Math.floor(Math.random()*tracks.length);
      return n;
    }
    return (idx + dir + tracks.length) % tracks.length;
  }

  function ensureAnalyser(){
    if (ac || !ovWave) return;
    try{
      ac = new (window.AudioContext || window.webkitAudioContext)();
      analyser = ac.createAnalyser();
      analyser.fftSize = 2048;
      waveData = new Uint8Array(analyser.fftSize);

      srcNode = ac.createMediaElementSource(audio);
      srcNode.connect(analyser);
      analyser.connect(ac.destination);

      if (ac.state === "suspended"){
        const resume = () => ac.resume().catch(()=>{});
        window.addEventListener("click", resume, { once:true });
        window.addEventListener("keydown", resume, { once:true });
      }
    }catch(e){
      console.warn("Analyser not available", e);
    }
  }

  function drawWave(){
    if (!ovWave || !waveCtx) return;

    const w = ovWave.width;
    const h = ovWave.height;

    // translucent "ghost" fade
    waveCtx.fillStyle = "rgba(0,0,0,0.10)";
    waveCtx.fillRect(0, 0, w, h);

    if (!analyser || !waveData){
      requestAnimationFrame(drawWave);
      return;
    }

    analyser.getByteTimeDomainData(waveData);

    // occasional glitch slice
    if (Math.random() < 0.05){
      const y = Math.floor(Math.random()*h);
      const sh = 6 + Math.floor(Math.random()*10);
      const dx = -18 + Math.random()*36;
      const img = waveCtx.getImageData(0, y, w, sh);
      waveCtx.putImageData(img, dx, y);
    }

    // waveform
    waveCtx.beginPath();
    const mid = h/2;
    for (let i=0; i<waveData.length; i++){
      const x = (i/(waveData.length-1))*w;
      const v = waveData[i]/255; // 0..1
      const y = mid + (v-0.5) * (h*0.78);
      if (i===0) waveCtx.moveTo(x,y);
      else waveCtx.lineTo(x,y);
    }

    waveCtx.lineWidth = 3;
    waveCtx.strokeStyle = "rgba(255,43,43,0.78)";
    waveCtx.stroke();

    waveCtx.globalCompositeOperation = "screen";
    waveCtx.lineWidth = 1;
    waveCtx.strokeStyle = "rgba(43,255,136,0.18)";
    waveCtx.stroke();
    waveCtx.globalCompositeOperation = "source-over";

    requestAnimationFrame(drawWave);
  }

  function syncPlayIcon(){
    // show PAUSE icon while playing; PLAY icon while paused
    const playing = !audio.paused && !!audio.src;
    ovPlayIcon?.classList.toggle("is-playing", playing);
  }

  async function playIndex(i, autostart=false){
    if (!tracks[i]) return;
    idx = i;
    const t = tracks[i];
    setTrackName(t.name);

    // free previous objectURL
    if (audio.dataset.objurl){
      URL.revokeObjectURL(audio.dataset.objurl);
      audio.dataset.objurl = "";
    }

    if (t.file){
      const u = URL.createObjectURL(t.file);
      audio.dataset.objurl = u;
      audio.src = u;
    } else {
      audio.src = t.src;
    }

    audio.load();
    renderList();
    syncPlayIcon();

    if (autostart){
      try { await audio.play(); } catch {}
    }
  }

  function togglePlay(){
    if (!tracks.length) return;
    if (!audio.src){ playIndex(idx,true); return; }
    if (audio.paused) audio.play().catch(()=>{});
    else audio.pause();
  }

  function updateUI(){
    ovTime.textContent = fmt(audio.currentTime);
    const d = audio.duration;
    const c = audio.currentTime;

    const totalPart = (playlistTotalSec != null) ? ` · TOTAL ${fmtLong(playlistTotalSec)}` : "";
    ovCounter.textContent = `${fmt(c)} / ${fmt(d)}${totalPart}`;

    const pct = d>0 ? (c/d)*100 : 0;
    ovProgFill.style.width = `${Math.max(0, Math.min(100,pct))}%`;
    syncPlayIcon();
  }

  // seek click
  ovProg.addEventListener("click", (e)=>{
    const r = ovProg.getBoundingClientRect();
    const pct = (e.clientX - r.left) / r.width;
    if (audio.duration>0) audio.currentTime = audio.duration*pct;
  });

  // hotspots
  hitPrev.addEventListener("click", ()=> playIndex(nextIndex(-1), true));
  hitPlay.addEventListener("click", togglePlay);
  hitNext.addEventListener("click", ()=> playIndex(nextIndex(+1), true));
  hitShuffle.addEventListener("click", ()=>{
    shuffle = !shuffle;
    ovShuffle?.classList.toggle("active", shuffle);
  });

  audio.addEventListener("ended", ()=> playIndex(nextIndex(+1), true));
  audio.addEventListener("play", ()=>{
    ensureAnalyser();
    if (ac?.state === "suspended") ac.resume().catch(()=>{});
    syncPlayIcon();
  });
  audio.addEventListener("pause", syncPlayIcon);

  setInterval(updateUI, 120);

  // ===== Volume =====
  let lastVol = 0.85;
  function setMuteUI(){
    const muted = audio.muted || audio.volume === 0;
    volMute.textContent = muted ? "🔇" : "🔊";
    volMute.classList.toggle("active", muted);
  }
  function setVolume(v){
    const nv = Math.max(0, Math.min(1, v));
    audio.volume = nv;
    if (nv > 0) lastVol = nv;
    audio.muted = (nv === 0);
    setMuteUI();
  }
  if (volSlider){
    volSlider.addEventListener("input", () => setVolume(Number(volSlider.value)));
    setVolume(Number(volSlider.value));
  }
  if (volMute){
    volMute.addEventListener("click", () => {
      const muted = audio.muted || audio.volume === 0;
      if (muted){
        audio.muted = false;
        const restore = lastVol > 0 ? lastVol : 0.85;
        audio.volume = restore;
        if (volSlider) volSlider.value = String(restore);
      } else {
        if (audio.volume > 0) lastVol = audio.volume;
        audio.muted = true;
        audio.volume = 0;
        if (volSlider) volSlider.value = "0";
      }
      setMuteUI();
    });
    setMuteUI();
  }

  // ===== Playlist total duration =====
  async function probeDurationForSrc(src){
    return new Promise((resolve) => {
      const probe = new Audio();
      let done = false;
      const finish = (v) => {
        if (done) return;
        done = true;
        probe.removeAttribute("src");
        probe.load();
        resolve(v);
      };
      const t = setTimeout(() => finish(null), 5000);
      probe.preload = "metadata";
      probe.addEventListener("loadedmetadata", () => {
        clearTimeout(t);
        const d = Number.isFinite(probe.duration) ? probe.duration : null;
        finish(d);
      });
      probe.addEventListener("error", () => {
        clearTimeout(t);
        finish(null);
      });
      probe.src = src;
    });
  }

  async function computePlaylistTotal(){
    if (!tracks.length) { playlistTotalSec = 0; return; }
    let sum = 0;
    for (const t of tracks){
      let src = t.src;
      let tmpUrl = null;
      if (t.file){
        tmpUrl = URL.createObjectURL(t.file);
        src = tmpUrl;
      }
      const d = await probeDurationForSrc(src);
      if (tmpUrl) URL.revokeObjectURL(tmpUrl);
      if (typeof d === "number" && Number.isFinite(d) && d > 0) sum += d;
    }
    playlistTotalSec = Math.floor(sum);
  }

  // ===== LOCAL MODE (file://) =====
  function loadLocalFiles(fileList){
    const files = Array.from(fileList||[]).filter(f => (f.name||"").toLowerCase().endsWith(".mp3"));
    files.sort((a,b)=> a.name.localeCompare(b.name,"es"));
    tracks = files.map(f => ({ name: stripMp3(f.name), file: f }));
    idx = 0;
    renderList();
    setTrackName(tracks[0]?.name || "—");
    computePlaylistTotal().catch(()=>{});
    if (tracks.length) playIndex(0,false);
  }

  pickFolder?.addEventListener("change", e => loadLocalFiles(e.target.files));
  pickFiles?.addEventListener("change", e => loadLocalFiles(e.target.files));

  // ===== GITHUB MODE (http/https) =====
  async function loadManifest(){
    const res = await fetch(`${MANIFEST_URL}?t=${Date.now()}`, { cache:"no-store" });
    if (!res.ok) throw new Error("manifest fetch failed");
    const json = await res.json();
    const list = Array.isArray(json) ? json : (json.tracks || []);
    tracks = list
      .filter(x => typeof x === "string" && x.toLowerCase().endsWith(".mp3"))
      .map(x => ({ name: baseName(x), src: x.startsWith("music/") ? x : `music/${x}` }));
    idx = tracks.length ? Math.floor(Math.random()*tracks.length) : 0;
    renderList();
    setTrackName(tracks[idx]?.name || "—");
    computePlaylistTotal().catch(()=>{});
    if (tracks.length) playIndex(idx,false);
  }

  // ===== CALIBRATION (D / C) =====
  function copyCoords(){
    const st = getComputedStyle(document.documentElement);
    const keys = [
      "--t-time-x","--t-time-y","--t-time-w","--t-time-h",
      "--t-name-x","--t-name-y","--t-name-w","--t-name-h",
      "--ct-x","--ct-y","--ct-w","--ct-h",
      "--p-x","--p-y","--p-w","--p-h",
      "--w-x","--w-y","--w-w","--w-h",
      "--l-x","--l-y","--l-w","--l-h",
      "--v-x","--v-y","--v-w","--v-h",
      "--b-prev-x","--b-prev-y","--b-prev-w","--b-prev-h",
      "--b-play-x","--b-play-y","--b-play-w","--b-play-h",
      "--b-next-x","--b-next-y","--b-next-w","--b-next-h",
      "--b-shuf-x","--b-shuf-y","--b-shuf-w","--b-shuf-h",
      "--loc-x","--loc-y","--loc-w","--loc-h"
    ];
    const out = keys.map(k => `${k}: ${st.getPropertyValue(k).trim()};`).join("\n");
    navigator.clipboard?.writeText(out).catch(()=>{});
    console.log(out);
  }

  window.addEventListener("keydown", (e)=>{
    if (e.key.toLowerCase() === "d") skin.classList.toggle("debug");
    if (e.key.toLowerCase() === "c") copyCoords();
  });

  // ===== INIT =====
  (async function init(){
    setTrackName("—");
    requestAnimationFrame(drawWave);
    syncPlayIcon();

    if (location.protocol === "file:"){
      localLoad.style.display = "flex";
      return;
    }

    try { await loadManifest(); }
    catch (err){
      console.error(err);
      setTrackName("manifest.json missing");
    }
  })();
})();