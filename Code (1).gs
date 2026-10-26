const CFG = {
  APP_NAME: 'Absensi Guru MI Miftahul Huda Pandemulyo',
  TZ: 'Asia/Jakarta',
  SHEETS: { GURU: 'Guru', ABSEN: 'Absensi', IZIN: 'Izin', CONFIG: 'Pengaturan' },
  SESSION_SECONDS: 21600
};

function doGet() {
  return HtmlService.createHtmlOutputFromFile('Index')
    .setTitle(CFG.APP_NAME)
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

function setupDatabase() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  if (!ss) throw new Error('Buka Apps Script dari Google Sheets yang akan digunakan.');
  const defs = [
    [CFG.SHEETS.GURU, ['userId','nama','email','role','passwordHash','salt','aktif','dibuatPada']],
    [CFG.SHEETS.ABSEN, ['id','tanggal','userId','nama','masuk','pulang','status','catatan','dibuatPada','diubahPada']],
    [CFG.SHEETS.IZIN, ['id','tanggalMulai','tanggalSelesai','userId','nama','jenis','alasan','status','dibuatPada']],
    [CFG.SHEETS.CONFIG, ['kunci','nilai']]
  ];
  defs.forEach(([name, headers]) => {
    let sh = ss.getSheetByName(name);
    if (!sh) sh = ss.insertSheet(name);
    if (sh.getLastRow() === 0) sh.getRange(1,1,1,headers.length).setValues([headers]);
    sh.setFrozenRows(1);
  });
  const cfg = ss.getSheetByName(CFG.SHEETS.CONFIG);
  if (cfg.getLastRow() < 2) {
    cfg.getRange(2,1,5,2).setValues([
      ['namaMadrasah','MI Miftahul Huda Pandemulyo'],
      ['jamMasuk','07:00'],
      ['jamPulangSeninKamisSabtu','14:30'],
      ['jamPulangJumat','11:30'],
      ['zonaWaktu','Asia/Jakarta']
    ]);
  }
  return 'Database siap. Berikutnya jalankan createAdmin("admin","GantiPasswordAdminYangKuat","Admin Madrasah","email-admin-anda").';
}

// Jalankan manual dari editor Apps Script. Ganti password contoh sebelum menjalankan.
function createAdmin(username, password, nama, email) {
  if (!username || !password || password.length < 12) throw new Error('Gunakan password minimal 12 karakter.');
  const sh = SpreadsheetApp.getActive().getSheetByName(CFG.SHEETS.GURU);
  if (!sh) throw new Error('Jalankan setupDatabase() terlebih dahulu.');
  const rows = sh.getDataRange().getValues();
  if (rows.slice(1).some(r => String(r[0]) === username)) throw new Error('userId sudah ada.');
  const salt = Utilities.getUuid();
  sh.appendRow([username, nama || 'Admin Madrasah', email || '', 'admin', hashPassword_(password, salt), salt, true, new Date()]);
  return 'Admin berhasil dibuat. Hapus password dari riwayat editor bila pernah ditulis langsung di kode.';
}

// Tambahkan guru lewat editor Apps Script. username unik, password minimal 12 karakter.
function addTeacher(username, password, nama, email) {
  if (!username || !password || password.length < 12 || !nama) throw new Error('Isi username, nama dan password minimal 12 karakter.');
  const sh = SpreadsheetApp.getActive().getSheetByName(CFG.SHEETS.GURU);
  if (!sh) throw new Error('Jalankan setupDatabase() terlebih dahulu.');
  const rows = sh.getDataRange().getValues();
  if (rows.slice(1).some(r => String(r[0]) === username)) throw new Error('userId sudah ada.');
  const salt = Utilities.getUuid();
  sh.appendRow([username, nama, email || '', 'guru', hashPassword_(password, salt), salt, true, new Date()]);
  return 'Akun guru berhasil ditambahkan.';
}

function hashPassword_(password, salt) {
  const bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, salt + '|' + password, Utilities.Charset.UTF_8);
  return bytes.map(b => ('0' + ((b + 256) % 256).toString(16)).slice(-2)).join('');
}
function constantTimeEqual_(a,b) {
  a=String(a); b=String(b); if (a.length!==b.length) return false;
  let out=0; for(let i=0;i<a.length;i++) out |= a.charCodeAt(i)^b.charCodeAt(i);
  return out===0;
}
function login(username, password) {
  username = String(username || '').trim();
  password = String(password || '');
  if (!username || !password) throw new Error('Masukkan username dan password.');
  const cache = CacheService.getScriptCache();
  const key = 'loginfail_' + hashPassword_(username, 'rate');
  const fails = Number(cache.get(key) || 0);
  if (fails >= 8) throw new Error('Terlalu banyak percobaan. Coba lagi sekitar 15 menit.');
  const sh = SpreadsheetApp.getActive().getSheetByName(CFG.SHEETS.GURU);
  const rows = sh.getDataRange().getValues();
  const user = rows.slice(1).find(r => String(r[0]) === username && (r[6] === true || String(r[6]).toLowerCase()==='true'));
  if (!user || !constantTimeEqual_(hashPassword_(password, user[5]), user[4])) {
    cache.put(key, String(fails + 1), 900);
    throw new Error('Username atau password salah, atau akun tidak aktif.');
  }
  cache.remove(key);
  const token = Utilities.getUuid() + Utilities.getUuid();
  const session = {userId:String(user[0]), nama:String(user[1]), role:String(user[3])};
  cache.put('session_' + token, JSON.stringify(session), CFG.SESSION_SECONDS);
  return {token:token, user:{userId:session.userId,nama:session.nama,role:session.role}};
}
function getSession_(token) {
  if (!token || typeof token !== 'string') throw new Error('Sesi tidak valid. Silakan login kembali.');
  const raw = CacheService.getScriptCache().get('session_' + token);
  if (!raw) throw new Error('Sesi berakhir. Silakan login kembali.');
  return JSON.parse(raw);
}
function logout(token) { if (token) CacheService.getScriptCache().remove('session_' + token); return true; }

function getDashboard(token) {
  const u = getSession_(token);
  const today = dateKey_(new Date());
  const sh = SpreadsheetApp.getActive().getSheetByName(CFG.SHEETS.ABSEN);
  const rows = sh.getDataRange().getValues().slice(1);
  const mine = rows.filter(r => dateKey_(r[1]) === today && (u.role === 'admin' || String(r[2]) === u.userId));
  return {user:u, today:today, records:mine.map(recordObj_), hours:{masuk:'07:00', pulangMonThuSat:'14:30', pulangFri:'11:30'}};
}
function recordObj_(r) {
  return {id:String(r[0]), tanggal:dateKey_(r[1]), userId:String(r[2]), nama:String(r[3]), masuk:r[4] ? timeKey_(r[4]) : '', pulang:r[5] ? timeKey_(r[5]) : '', status:String(r[6] || ''), catatan:String(r[7] || '')};
}
function dateKey_(v) {
  if (v instanceof Date) return Utilities.formatDate(v, CFG.TZ, 'yyyy-MM-dd');
  return String(v || '').slice(0,10);
}
function timeKey_(v) {
  if (v instanceof Date) return Utilities.formatDate(v, CFG.TZ, 'HH:mm:ss');
  return String(v || '');
}
function nowTime_() { return Utilities.formatDate(new Date(), CFG.TZ, 'HH:mm:ss'); }
function today_() { return Utilities.formatDate(new Date(), CFG.TZ, 'yyyy-MM-dd'); }

function markAttendance(token, action) {
  const u = getSession_(token);
  if (!['masuk','pulang'].includes(action)) throw new Error('Jenis absensi tidak valid.');
  const lock = LockService.getScriptLock(); lock.waitLock(10000);
  try {
    const sh = SpreadsheetApp.getActive().getSheetByName(CFG.SHEETS.ABSEN);
    const rows = sh.getDataRange().getValues();
    const today = today_();
    let idx = -1;
    for (let i=1;i<rows.length;i++) {
      if (dateKey_(rows[i][1])===today && String(rows[i][2])===u.userId) { idx=i+1; break; }
    }
    const now = new Date();
    if (idx < 0) {
      if (action === 'pulang') throw new Error('Absen masuk belum tercatat.');
      sh.appendRow([Utilities.getUuid(), today, u.userId, u.nama, now, '', 'Hadir', '', now, now]);
    } else {
      const current = sh.getRange(idx,1,1,10).getValues()[0];
      if (action === 'masuk') throw new Error('Absen masuk hari ini sudah tercatat.');
      if (current[5]) throw new Error('Absen pulang hari ini sudah tercatat.');
      sh.getRange(idx,6).setValue(now);
      sh.getRange(idx,10).setValue(now);
    }
    return {ok:true, message:action==='masuk'?'Absen masuk berhasil disimpan.':'Absen pulang berhasil disimpan.', time:nowTime_()};
  } finally { lock.releaseLock(); }
}
function submitStatus(token, jenis, tanggal, alasan) {
  const u = getSession_(token);
  if (!['Izin','Sakit'].includes(jenis)) throw new Error('Status tidak valid.');
  const d = String(tanggal || today_());
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) throw new Error('Tanggal tidak valid.');
  const sh = SpreadsheetApp.getActive().getSheetByName(CFG.SHEETS.IZIN);
  sh.appendRow([Utilities.getUuid(), d, d, u.userId, u.nama, jenis, String(alasan||'').slice(0,500), 'Diajukan', new Date()]);
  return {ok:true,message:'Pengajuan '+jenis+' berhasil dicatat.'};
}
function getReport(token, month) {
  const u = getSession_(token);
  if (u.role !== 'admin') throw new Error('Hanya admin yang dapat melihat rekap seluruh guru.');
  const sh = SpreadsheetApp.getActive().getSheetByName(CFG.SHEETS.ABSEN);
  const rows = sh.getDataRange().getValues().slice(1).filter(r => dateKey_(r[1]).slice(0,7) === month);
  return rows.map(recordObj_).sort((a,b)=>a.tanggal.localeCompare(b.tanggal)||a.nama.localeCompare(b.nama));
}
function exportReport(token, month, format) {
  const u = getSession_(token);
  if (u.role !== 'admin') throw new Error('Hanya admin yang dapat mengekspor laporan.');
  if (!['xlsx','pdf'].includes(format)) throw new Error('Format tidak didukung.');
  const rows = getReport(token, month);
  const tmp = SpreadsheetApp.create('Temp_Absensi_' + month + '_' + Date.now());
  const sh = tmp.getSheets()[0]; sh.setName('Rekap Absensi');
  const data = [['Tanggal','Username','Nama Guru','Absen Masuk','Absen Pulang','Status','Catatan']]
    .concat(rows.map(r=>[r.tanggal,r.userId,r.nama,r.masuk,r.pulang,r.status,r.catatan]));
  sh.getRange(1,1,data.length,data[0].length).setValues(data);
  sh.getRange(1,1,1,data[0].length).setFontWeight('bold');
  sh.autoResizeColumns(1,data[0].length);
  SpreadsheetApp.flush();
  const mime = format==='xlsx' ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' : 'application/pdf';
  const url = 'https://docs.google.com/spreadsheets/d/'+tmp.getId()+'/export?format='+(format==='xlsx'?'xlsx':'pdf')+'&portrait=true&fitw=true&sheetnames=false&printtitle=false&pagenumbers=true&gridlines=true';
  const response = UrlFetchApp.fetch(url,{headers:{Authorization:'Bearer '+ScriptApp.getOAuthToken()}, muteHttpExceptions:true});
  const status = response.getResponseCode();
  if (status !== 200) { DriveApp.getFileById(tmp.getId()).setTrashed(true); throw new Error('Ekspor gagal. Periksa izin Drive dan coba lagi.'); }
  const blob = response.getBlob().setName('Rekap_Absensi_'+month+'.'+format);
  const result = {filename:blob.getName(), mimeType:mime, base64:Utilities.base64Encode(blob.getBytes())};
  DriveApp.getFileById(tmp.getId()).setTrashed(true);
  return result;
}
