// 3D 화면만 녹화 (도구 · 막대 빼고 캔버스만) → MP4 (안 되는 기기는 WebM)
const TYPES = ['video/mp4;codecs=avc1.640028', 'video/mp4;codecs=avc1.4d002a', 'video/mp4;codecs=avc1', 'video/mp4', 'video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm'];
export const recType = () => (typeof MediaRecorder === 'undefined' ? null : TYPES.find((t) => MediaRecorder.isTypeSupported(t)) || null);
export class CanvasRec {
  constructor(canvas) { this.cv = canvas; this.on = false; }
  /** max 초 뒤 자동으로 멈춤 · onTick(경과초) · 끝나면 Promise<{ blob, ext, sec }> */
  start({ max = 30, fps = 30, kbps = 12000, onTick } = {}) {
    const type = recType(); if (!type) throw new Error('이 기기는 화면 녹화를 지원하지 않아요');
    const stream = this.cv.captureStream(fps), chunks = [], rec = new MediaRecorder(stream, { mimeType: type, videoBitsPerSecond: kbps * 1000 });
    this.on = true; this.t0 = performance.now(); this.rec = rec; this.ext = /mp4/.test(type) ? 'mp4' : 'webm';
    rec.ondataavailable = (e) => { if (e.data && e.data.size) chunks.push(e.data); };
    this.done = new Promise((ok, bad) => { rec.onstop = () => { this.on = false; clearInterval(this.iv); clearTimeout(this.to); stream.getTracks().forEach((t) => t.stop()); ok({ blob: new Blob(chunks, { type: type.split(';')[0] }), ext: this.ext, sec: (performance.now() - this.t0) / 1000 }); }; rec.onerror = (e) => { this.on = false; bad(e.error || e); }; });
    rec.start(500); this.iv = setInterval(() => onTick && onTick((performance.now() - this.t0) / 1000), 200); this.to = setTimeout(() => this.stop(), max * 1000);
    return this.done;
  }
  stop() { if (this.rec && this.rec.state !== 'inactive') this.rec.stop(); }
}
