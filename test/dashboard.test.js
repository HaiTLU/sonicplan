import { test } from 'node:test';
import assert from 'node:assert/strict';
import { dungCsdl,d1 } from './csdl-thu.js';
import { xuLyDashboard } from '../src/api/dashboard.js';
import { ngayVN } from '../src/tien-ich.js';
function setup() {
 const db=dungCsdl(); const env={CSDL:d1(db)};
 const phien={to_chuc:{id:'a',vai_tro:'chu'},nguoi_dung:{id:'u'}};
 const call=(path,method='GET',body,session=phien)=>xuLyDashboard(new Request('https://example.com'+path,{method,...(body===undefined?{}:{body:JSON.stringify(body)})}),env,session,new URL('https://example.com'+path));
 return {db,env,phien,call};
}
test('dashboard việc: lọc dự án và tổ chức, việc quá hạn lên trước',async()=>{
 const {db,call}=setup(); const now=new Date().toISOString();
 db.prepare('INSERT INTO du_an(id,to_chuc_id,ten,tao_luc) VALUES (?,?,?,?)').run(9,'a','Dự án',now);
 for(const [tc,title,date,project,priority] of [['a','Hôm nay',ngayVN(),9,'cao'],['a','Quá hạn','2000-01-01',null,'thap'],['b','Bí mật','2000-01-01',null,'cao']]) db.prepare('INSERT INTO viec(to_chuc_id,tieu_de,han_ngay,du_an_id,uu_tien,tao_luc,cap_nhat_luc) VALUES (?,?,?,?,?,?,?)').run(tc,title,date,project,priority,now,now);
 let r=await (await call('/api/dashboard/core')).json(); assert.deepEqual(r.viec.map(x=>x.tieu_de),['Quá hạn','Hôm nay']); assert.equal(r.so_lieu.viec_mo,2);
 r=await (await call('/api/dashboard/core?du_an=none')).json(); assert.equal(r.viec.length,1); assert.equal(r.so_lieu.viec_mo,1);
 r=await (await call('/api/dashboard/core?du_an=9')).json(); assert.equal(r.viec[0].du_an_ten,'Dự án');
 assert.equal((await call('/api/dashboard/core?du_an=9%20OR%201')).status,400);
});
test('dashboard đề xuất: chỉ chủ, không đổi bản trước hay nguồn, cách ly tổ chức',async()=>{
 const {call,phien}=setup(); const member={...phien,to_chuc:{id:'a',vai_tro:'thanh_vien'}};
 assert.equal((await call('/api/dashboard/proposals','GET',undefined,member)).status,403);
 assert.equal((await call('/api/dashboard/proposals','POST',{})).status,400);
 const body={tieu_de:'Bài học',truoc:'Cũ',sau:'Mới',nguon:'memory/projects/x.md',phien_ban:'sha256-original',trang_thai:'approved'};
 const made=await (await call('/api/dashboard/proposals','POST',body)).json(); const id=made.de_xuat.id;assert.equal(made.id,id);assert.equal(made.de_xuat.trang_thai,'approved');
 assert.equal((await call('/api/dashboard/proposals/'+id,'PATCH',{sau:'Khác',truoc:'Giả',nguon:'Giả',phien_ban:'sha256-fake',nguoi_de_xuat:'fake',trang_thai:'approved'})).status,200);
 const r=await (await call('/api/dashboard/proposals')).json(); assert.equal(r.ds[0].truoc,'Cũ');assert.equal(r.ds[0].phien_ban,'sha256-original');assert.equal(r.ds[0].nguoi_de_xuat,'u');assert.equal(r.ds[0].nguon,body.nguon);assert.equal(r.ds[0].trang_thai,'approved');
 const other={...phien,to_chuc:{id:'b',vai_tro:'chu'}};
 assert.equal((await call('/api/dashboard/proposals/'+id,'PATCH',{sau:'X'},other)).status,404);
 assert.deepEqual((await (await call('/api/dashboard/proposals','GET',undefined,other)).json()).ds,[]);
});
test('dashboard memory không gọi bộ đọc second-brain cho thành viên',async()=>{
 const {env,call,phien}=setup();let calls=0;env.SECOND_BRAIN={doc:async()=>{calls++;return {trang_thai:'san_sang',doc_luc:'x',ds:[]};}};
 await call('/api/dashboard/memory','GET',undefined,{...phien,to_chuc:{id:'a',vai_tro:'thanh_vien'}});assert.equal(calls,0);
 await call('/api/dashboard/memory');assert.equal(calls,1);
});
test('dashboard history ngày Việt Nam và giới hạn 7/30',async()=>{
 const {db,call}=setup();const now=new Date().toISOString();
 for(const tc of ['a','b']) db.prepare('INSERT INTO viec(to_chuc_id,tieu_de,tao_luc,cap_nhat_luc) VALUES (?,?,?,?)').run(tc,'Việc',now,now);
 const r=await (await call('/api/dashboard/history?days=7')).json(); assert.equal(r.ds.length,7);assert.equal(r.ds.at(-1).ngay,ngayVN());assert.equal(r.ds.at(-1).viec,1);
 assert.equal((await call('/api/dashboard/history?days=999')).status,400);
 assert.equal((await call('/api/dashboard/proposals/ai','POST',{noi_dung:'a'})).status,400);
});

test('dashboard hàng chờ và cảnh báo cũ không lẫn lỗi mới hay tổ chức khác',async()=>{
 const {db,call}=setup();const now=new Date().toISOString();
 for(const [tc,state] of [['a',0],['a',2],['a',3],['b',2]]) db.prepare('INSERT INTO tin_nhan(to_chuc_id,nguon,ma_goc,thoi_diem,tao_luc,da_tach,tach_luc) VALUES (?,\'zalo\',?,?,?,?,?)').run(tc,tc+state,now,now,state,now);
 for(const [tc,task,status] of [['a','recovered','loi'],['a','recovered','xong'],['a','current','loi'],['b','secret','loi'],['b','secret','xong']]) db.prepare('INSERT INTO nhat_ky_chay(to_chuc_id,tac_vu,trang_thai,bat_dau,ket_thuc) VALUES (?,?,?,?,?)').run(tc,task,status,now,now);
 const r=await (await call('/api/dashboard/core')).json();assert.equal(r.hang_cho.dang_xu_ly,1);assert.equal(r.hang_cho.tin_cho,1);assert.equal(r.hang_cho.xu_ly_cu_nhat,now);
 assert.deepEqual(r.canh_bao_cu.map(x=>x.tac_vu),['recovered']);assert.equal(r.lan_chay.find(x=>x.tac_vu==='current').trang_thai,'loi');assert.ok(r.lan_chay.every(x=>x.tac_vu!=='secret'));
});
test('dashboard đề xuất từ chối trạng thái và kiểu dữ liệu sai',async()=>{
 const {call}=setup();const b={tieu_de:'x',truoc:'',sau:'y',nguon:'z'};
 for(const change of [{trang_thai:null},{trang_thai:''},{trang_thai:'invalid'},{phien_ban:15},{sau:' '.repeat(10)},{tieu_de:[] }]) assert.equal((await call('/api/dashboard/proposals','POST',{...b,...change})).status,400);
});
test('dashboard bố cục giữ kích thước và nguồn chưa nối dùng trạng thái chuẩn',async()=>{
 const {db,call}=setup();const dashboard={thu_tu:['tri-nho'],an:['xu-huong'],kich_thuoc:{'tri-nho':'rong'}};
 db.prepare('INSERT INTO cai_dat(to_chuc_id,khoa,gia_tri) VALUES (?,?,?)').run('a','tq_bo_cuc:u',JSON.stringify({dashboard}));
 const layout=await (await call('/api/dashboard/layout')).json();assert.equal(layout.bo_cuc.kich_thuoc['tri-nho'],'rong');assert.equal(layout.bo_cuc.thu_tu[0],'tri-nho');
 assert.equal((await (await call('/api/dashboard/memory')).json()).second_brain.trang_thai,'unconfigured');
});
test('dashboard ưu tiên trước hạn, giờ hẹn và mốc hoàn thành ngày Việt Nam',async()=>{
 const {db,call}=setup();const day=ngayVN();const now=new Date().toISOString();
 for(const [title,priority,time] of [['Thấp','thap','08:00'],['Cao muộn','cao','10:00'],['Cao sớm','cao','09:00']]) db.prepare('INSERT INTO viec(to_chuc_id,tieu_de,uu_tien,han_ngay,gio_hen,tao_luc,cap_nhat_luc) VALUES (?,?,?,?,?,?,?)').run('a',title,priority,day,time,now,now);
 const start=Date.parse(`${day}T00:00:00+07:00`);
 for(const [tc,timestamp] of [['a',start],['a',start-1],['b',start]]) db.prepare("INSERT INTO viec(to_chuc_id,tieu_de,trang_thai,tao_luc,cap_nhat_luc,xong_luc) VALUES (?,?,'xong',?,?,?)").run(tc,'Đã xong',now,now,new Date(timestamp).toISOString());
 const r=await (await call('/api/dashboard/core')).json();assert.deepEqual(r.viec.map(x=>x.tieu_de),['Cao sớm','Cao muộn','Thấp']);assert.equal(r.so_lieu.xong_hom_nay,1);
 const history=await (await call('/api/dashboard/history')).json();assert.equal(history.ds.at(-1).xong,1);
});
test('dashboard chi tiết kiểm ngày và lọc đúng khoảng ngày Việt Nam',async()=>{
 const {db,call}=setup();const day=ngayVN(),now=new Date().toISOString(),start=Date.parse(`${day}T00:00:00+07:00`);
 for(const [tc,stamp] of [['a',start],['a',start-1],['b',start]]) db.prepare('INSERT INTO viec(to_chuc_id,tieu_de,tao_luc,cap_nhat_luc) VALUES (?,?,?,?)').run(tc,'X',new Date(stamp).toISOString(),now);
 const r=await (await call(`/api/dashboard/details?kind=viec&ngay=${day}`)).json();assert.equal(r.ds.length,1);
 assert.equal((await call('/api/dashboard/details?kind=viec&ngay=2026-02-30')).status,400);assert.equal((await call('/api/dashboard/details?kind=unknown')).status,400);
});
test('dashboard AI metadata distinguishes configured state and old warning recovered by real run',async()=>{
 const {db,call,env}=setup();env.AI={run:async()=>{throw new Error('Dashboard must not call AI');}};
 db.prepare('INSERT INTO tin_hieu(to_chuc_id,nguon,lan_cuoi,ghi_chu) VALUES (?,?,?,?)').run('a','ai','2026-01-01T00:00:00Z','Lỗi API');
 db.prepare('INSERT INTO nhat_ky_chay(to_chuc_id,tac_vu,trang_thai,bat_dau,ket_thuc) VALUES (?,?,?,?,?)').run('a','tach-viec','xong','2026-01-02T00:00:00Z','2026-01-02T00:01:00Z');
 const r=await (await call('/api/dashboard/core')).json();assert.equal(r.ai.api_da_cau_hinh,false);assert.equal(r.ai.workers_ai,true);assert.equal(r.ai.canh_bao.da_hoi_phuc,true);assert.equal(r.ai.mo_hinh,null);
});

test('dashboard lọc nhóm việc trước giới hạn, không che việc hôm nay sau hàng trăm việc quá hạn',async()=>{
 const {db,call}=setup();const now=new Date().toISOString();const insert=db.prepare('INSERT INTO viec(to_chuc_id,tieu_de,han_ngay,uu_tien,tao_luc,cap_nhat_luc) VALUES (?,?,?,?,?,?)');
 for(let i=0;i<110;i++)insert.run('a',`Trễ ${i}`,'2000-01-01','vua',now,now);
 insert.run('a','Hôm nay ưu tiên',ngayVN(),'cao',now,now);
 const r=await(await call('/api/dashboard/core?mode=today')).json();assert.equal(r.viec.length,1);assert.equal(r.viec[0].tieu_de,'Hôm nay ưu tiên');assert.equal(r.so_lieu.viec_qua_han,110);
 assert.equal((await call('/api/dashboard/core?mode=invalid')).status,400);
});
