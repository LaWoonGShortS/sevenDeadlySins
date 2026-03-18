const express = require('express');
const cors    = require('cors');
const fs      = require('fs');
const path    = require('path');

const app  = express();
const PORT = 3000;
const PUBLIC  = path.join(__dirname, 'public');
const DATA_DIR = path.join(__dirname, 'data');
const DATA_FILE = path.join(DATA_DIR, 'mapdata.json');

// ── 데이터 폴더 & 파일 초기화 ────────────────────────────────
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
if (!fs.existsSync(DATA_FILE)) {
  const defaultData = [
    {
      id: 'region_lioness',
      name: '1. 페네스 호반 (리오네스)',
      mapFile: 'map_lioness.png',
      markers: []
    }
  ];
  fs.writeFileSync(DATA_FILE, JSON.stringify(defaultData, null, 2), 'utf8');
  console.log('기본 데이터 파일 생성:', DATA_FILE);
}

// ── 미들웨어 ──────────────────────────────────────────────────
app.use(cors());
// JSON body - 이미지(base64) 포함하므로 넉넉하게
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// ── 유틸 ──────────────────────────────────────────────────────
function readData() {
  try {
    return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  } catch (e) {
    console.error('데이터 읽기 오류:', e);
    return [];
  }
}
function writeData(data) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf8');
}

// ── API: 전체 데이터 조회 ──────────────────────────────────────
app.get('/api/data', (req, res) => {
  res.json(readData());
});

// ── API: 전체 데이터 교체 (import) ────────────────────────────
app.put('/api/data', (req, res) => {
  const data = req.body;
  if (!Array.isArray(data)) return res.status(400).json({ error: '배열 형식 필요' });
  writeData(data);
  res.json({ ok: true, regions: data.length });
});

// ── API: 지역 추가 ────────────────────────────────────────────
app.post('/api/regions', (req, res) => {
  const { id, name, mapFile } = req.body;
  if (!id || !name || !mapFile) return res.status(400).json({ error: '필드 누락' });
  const data = readData();
  if (data.find(r => r.id === id)) return res.status(409).json({ error: '이미 존재하는 ID' });
  data.push({ id, name, mapFile, markers: [] });
  writeData(data);
  res.json({ ok: true });
});

// ── API: 지역 수정 ────────────────────────────────────────────
app.put('/api/regions/:id', (req, res) => {
  const data = readData();
  const r = data.find(r => r.id === req.params.id);
  if (!r) return res.status(404).json({ error: '지역 없음' });
  if (req.body.name)    r.name    = req.body.name;
  if (req.body.mapFile) r.mapFile = req.body.mapFile;
  writeData(data);
  res.json({ ok: true });
});

// ── API: 지역 삭제 ────────────────────────────────────────────
app.delete('/api/regions/:id', (req, res) => {
  let data = readData();
  const before = data.length;
  data = data.filter(r => r.id !== req.params.id);
  if (data.length === before) return res.status(404).json({ error: '지역 없음' });
  writeData(data);
  res.json({ ok: true });
});

// ── API: 마커 목록 조회 ───────────────────────────────────────
app.get('/api/regions/:id/markers', (req, res) => {
  const data = readData();
  const r = data.find(r => r.id === req.params.id);
  if (!r) return res.status(404).json({ error: '지역 없음' });
  res.json(r.markers);
});

// ── API: 마커 추가 ────────────────────────────────────────────
app.post('/api/regions/:id/markers', (req, res) => {
  const data = readData();
  const r = data.find(r => r.id === req.params.id);
  if (!r) return res.status(404).json({ error: '지역 없음' });
  const { id, type, x, y, name, note, images } = req.body;
  if (!id || !type) return res.status(400).json({ error: '필드 누락' });
  r.markers.push({ id, type, x, y, name: name||'', note: note||'', images: images||[] });
  writeData(data);
  res.json({ ok: true });
});

// ── API: 마커 수정 ────────────────────────────────────────────
app.put('/api/regions/:rid/markers/:mid', (req, res) => {
  const data = readData();
  const r = data.find(r => r.id === req.params.rid);
  if (!r) return res.status(404).json({ error: '지역 없음' });
  const m = r.markers.find(m => m.id === req.params.mid);
  if (!m) return res.status(404).json({ error: '마커 없음' });
  const { x, y, name, note, images } = req.body;
  if (x !== undefined) m.x = x;
  if (y !== undefined) m.y = y;
  if (name !== undefined) m.name = name;
  if (note !== undefined) m.note = note;
  if (images !== undefined) m.images = images;
  writeData(data);
  res.json({ ok: true });
});

// ── API: 마커 삭제 ────────────────────────────────────────────
app.delete('/api/regions/:rid/markers/:mid', (req, res) => {
  const data = readData();
  const r = data.find(r => r.id === req.params.rid);
  if (!r) return res.status(404).json({ error: '지역 없음' });
  const before = r.markers.length;
  r.markers = r.markers.filter(m => m.id !== req.params.mid);
  if (r.markers.length === before) return res.status(404).json({ error: '마커 없음' });
  writeData(data);
  res.json({ ok: true });
});

// ── API: 지역 전체 마커 삭제 ─────────────────────────────────
app.delete('/api/regions/:id/markers', (req, res) => {
  const data = readData();
  const r = data.find(r => r.id === req.params.id);
  if (!r) return res.status(404).json({ error: '지역 없음' });
  r.markers = [];
  writeData(data);
  res.json({ ok: true });
});

// ── API: 헬스체크 ─────────────────────────────────────────────
app.get('/api/health', (req, res) => {
  res.json({ ok: true, time: new Date().toISOString() });
});

// ── SPA fallback ──────────────────────────────────────────────
app.use(express.static(PUBLIC));
app.use((req, res) => {
  res.sendFile(path.join(PUBLIC, 'index.html'));
});

// ── 시작 ─────────────────────────────────────────────────────
app.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ 서버 실행 중: http://0.0.0.0:${PORT}`);
  console.log(`📁 데이터 파일: ${DATA_FILE}`);
});
