// Trung tâm điều hành: dữ liệu thật, không gọi AI khi tự làm mới.
import { api, bao, fmt, h, homNay, luc, thay, trang } from './chung.js';
import { moNganViec } from './viec.js';

const BLOCKS = { viec:'Việc cần làm', 'su-co':'Tình trạng hệ thống', 'van-hanh':'Hệ thống đang vận hành', 'tri-nho':'Trí nhớ và bài học', 'xu-huong':'Nhịp làm việc' };
const DEFAULT = { phien_ban:2, thu_tu:Object.keys(BLOCKS), an:[], kich_thuoc:{viec:'vua','su-co':'nho','van-hanh':'rong','tri-nho':'vua','xu-huong':'nho'} };
let current, chartLib;
const btn = (text, action, cls='') => h('button', {type:'button',class:`db-btn ${cls}`,onclick:action},text);
const link = (text, href) => h('a',{href,class:'db-link'},text);
const msg = (text) => h('p',{class:'db-empty',text});
const select = (label, options, val, change) => h('select',{'aria-label':label,onchange:e=>change(e.target.value)},...options.map(([v,t])=>h('option',{value:v,selected:String(v)===String(val)},t)));
const date = iso => iso ? fmt.ngayGio.format(new Date(iso)) : 'Chưa có dữ liệu';
const aiCaption = a => a?.api_da_cau_hinh ? `${a.nha_cung_cap||'API riêng'}${a.mo_hinh?' · '+a.mo_hinh:''}${a.workers_ai?' · dự phòng Workers AI':''}` : a?.workers_ai ? 'Workers AI qua API' : 'Chưa cấu hình AI';
const own = () => trang.toi?.to_chuc?.vai_tro === 'chu';

export async function veDashboard(root) {
  current?.dispose();
  const d = new Dashboard(root); current = d;
  await d.start();
}
class Dashboard {
  constructor(root) { this.root=root; this.filter='all';this.days=7;this.edit=false;this.busy=false;this.dead=false;this.layout=structuredClone(DEFAULT);this.charts=[];this.sources='all';this.query='';this.memory=null;this.proposals=[];this.loaded=false; }
  dispose(){this.dead=true;clearInterval(this.timer);this.charts.forEach(c=>c.destroy());this.abort?.abort();}
  active(){return !this.dead && (location.hash.slice(1).split('/')[0]||'tong-quan')==='tong-quan' && this.root.isConnected;}
  paused(){return this.edit||this.busy||document.hidden||document.querySelector('dialog[open]')||this.root.contains(document.activeElement)&&document.activeElement.matches('input,select,textarea') ;}
  async start(){
    thay(this.root,h('div',{class:'db-loading',role:'status'},'Đang mở trung tâm điều hành…'));
    try {
      const [layout,core] = await Promise.all([api('/api/dashboard/layout'),api('/api/dashboard/core')]);
      if(!this.active())return;
      this.legacy={};this.layout=layout.bo_cuc;this.core=core;
      this.loaded=true;this.render();this.loadExtras();
      api('/api/tinh-trang').then(health=>{if(this.active()){this.health=health;this.updateBlock('su-co');this.updateBlock('van-hanh');}}).catch(e=>{this.healthError=e.message;if(this.active())this.updateBlock('su-co');});
      this.timer=setInterval(()=>{if(!this.active()){this.dispose();return;}if(!this.paused())this.refresh();},30000);
    }catch(e){if(this.active())thay(this.root,msg(e.message),btn('Thử lại',()=>this.start()));}
  }
  migrate(bc){if(JSON.stringify(bc.thu_tu)===JSON.stringify(['can-lam','de-xuat-claude','chi-so','du-an','viec-toi','nhip','hieu-suat','tong-hop','tin-moi','he-thong'])&&!(bc.an||[]).length)return structuredClone(DEFAULT);const m={'can-lam':'viec','viec-toi':'viec','he-thong':'su-co',nhip:'xu-huong'};const t=[...new Set((bc.thu_tu||[]).map(k=>m[k]).filter(Boolean))];return {...structuredClone(DEFAULT),thu_tu:[...t,...DEFAULT.thu_tu.filter(k=>!t.includes(k))],an:[...new Set((bc.an||[]).map(k=>m[k]).filter(Boolean))]};}
  async loadExtras(){
    await Promise.allSettled([
      this.loadHistory(),
      (async()=>{try{const [m,p]=await Promise.all([api('/api/dashboard/memory'),own()?api('/api/dashboard/proposals'):Promise.resolve({ds:[]})]);if(this.active()){this.memory=m;this.proposals=p.ds;this.updateBlock('tri-nho');}}catch(e){this.memoryError=e.message;if(this.active())this.updateBlock('tri-nho');}})(),
    ]);
  }
  async loadHistory(){const key=`${this.days}:${this.filter}`;try{const data=await api(`/api/dashboard/history?days=${this.days}&du_an=${this.filter}`);if(this.active()&&key===`${this.days}:${this.filter}`){this.history=data;this.updateBlock('xu-huong');}}catch(e){this.historyError=e.message;if(this.active())this.updateBlock('xu-huong');}}
  async refresh(force=false){
    if(this.refreshing||!this.active()||!force&&this.paused())return;
    this.refreshing=true;const filter=this.filter,mode=this.taskMode||'all';
    try{const [c,health]=await Promise.all([api(`/api/dashboard/core?du_an=${this.filter}&mode=${this.taskMode==='done'?'all':this.taskMode||'all'}`),api('/api/tinh-trang')]);if(!this.active()||(filter!==this.filter||mode!==(this.taskMode||'all'))||!force&&this.paused())return;this.core=c;this.health=health;this.render();this.loadExtras();}
    catch(e){if(this.active()){this.stale=e.message;this.status.textContent=`Chưa cập nhật: ${e.message}. Dữ liệu gần nhất ${date(this.core.cap_nhat_luc)}.`;}}
    finally{this.refreshing=false;if((filter!==this.filter||mode!==(this.taskMode||'all'))&&this.active())this.refresh(true);}
  }
  async save(){
    const snapshot=structuredClone(this.layout);
    this.saveQueue=(this.saveQueue||Promise.resolve()).catch(()=>{}).then(async()=>{
      try{const r=await api('/api/tong-quan/bo-cuc',{method:'PUT',body:JSON.stringify({...this.legacy,dashboard:snapshot})});this.legacy={};bao('Đã lưu bố cục theo tài khoản.');}
      catch(e){bao(`Chưa lưu bố cục: ${e.message}`,{loi:true});}
    });return this.saveQueue;
  }

  render(){
    this.charts.forEach(c=>c.destroy());this.charts=[];
    const c=this.core, counts=c.so_lieu;
    this.status=h('span',{class:'db-fresh',role:'status'},`Cập nhật ${date(c.cap_nhat_luc)} · Tự làm mới 30 giây`);
    const header=h('header',{class:'db-header'},h('div',{},h('p',{class:'db-date',text:fmt.ngayDai.format(new Date())}),h('h2',{},'Trung tâm điều hành'),this.status),
      h('div',{class:'db-toolbar'},select('Lọc dự án',[['all','Tất cả dự án'],['none','Chưa xếp dự án'],...(c.du_an||[]).map(p=>[p.id,p.ten])],this.filter,v=>{this.filter=v;this.refresh(true);}),btn('Làm mới',()=>this.refresh(true)),btn(this.edit?'Xong bố cục':'Chỉnh bố cục',()=>{this.edit=!this.edit;this.render();},this.edit?'db-primary':'')));
    const stat=(label,value,kind,filter)=>h('button',{class:`db-stat ${kind||''}`,onclick:()=>{this.taskMode=filter;this.refresh(true);this.grid.querySelector('[data-block="viec"]')?.scrollIntoView({behavior:'smooth',block:'start'});}},h('strong',{},String(value||0)),h('span',{},label));
    const stats=h('div',{class:'db-stats'},stat('Quá hạn',counts.viec_qua_han,'db-danger','overdue'),stat('Cần làm hôm nay',counts.viec_hom_nay,'','today'),stat('Ưu tiên cao',counts.viec_uu_tien,'','priority'),stat('Đã xong hôm nay',counts.xong_hom_nay,'db-good','done'));
    this.grid=h('div',{class:`db-grid ${this.edit?'db-editing':''}`});
    const shell=h('div',{class:'dashboard'},header,stats,
      this.edit?h('div',{class:'db-customize'},h('span',{},'Kéo tay nắm để đổi chỗ. Bố cục lưu cho tài khoản này.'),...Object.entries(BLOCKS).map(([k,t])=>h('label',{},h('input',{type:'checkbox',checked:!this.layout.an.includes(k),onchange:e=>{this.layout.an=e.target.checked?this.layout.an.filter(x=>x!==k):[...this.layout.an,k];this.save();this.render();}}),t)),btn('Khôi phục mặc định',()=>{this.layout=structuredClone(DEFAULT);this.save();this.render();})):null,this.grid,
      h('footer',{class:'db-footer'},h('span',{},'AI qua API · Không dùng Claude Max'),link('Mở Tổng quan cũ','?tongquan=cu#tong-quan')));
    thay(this.root,shell);
    for(const k of this.layout.thu_tu)if(!this.layout.an.includes(k))this.grid.append(this.block(k));
    if(!this.grid.children.length)this.grid.append(msg('Các khối đang ẩn. Chọn Chỉnh bố cục để hiện lại.'));
  }
  block(k){
    const body=h('div',{class:'db-body'});const box=h('section',{class:`db-card db-size-${this.layout.kich_thuoc[k]||'vua'}`,dataset:{block:k}},
      h('header',{class:'db-card-header'},h('h3',{},BLOCKS[k]),this.edit?this.controls(k):null),body);
    this.fill(k,body);
    box.addEventListener('dragover',e=>{if(this.edit&&this.drag&&this.drag!==k){e.preventDefault();box.classList.add('db-target');}});
    box.addEventListener('dragleave',()=>box.classList.remove('db-target'));
    box.addEventListener('drop',e=>{e.preventDefault();box.classList.remove('db-target');if(this.drag&&this.drag!==k){const t=this.layout.thu_tu;t.splice(t.indexOf(this.drag),1);t.splice(t.indexOf(k),0,this.drag);this.drag=null;this.save();this.render();}});
    return box;
  }
  controls(k){const handle=btn('Kéo',()=>{},'db-handle');handle.setAttribute('aria-label',`Kéo khối ${BLOCKS[k]}`);
    let start=null,target=null;
    handle.addEventListener('pointerdown',e=>{if(e.button!==0)return;start={x:e.clientX,y:e.clientY};target=null;handle.setPointerCapture(e.pointerId);});
    handle.addEventListener('pointermove',e=>{if(!start||Math.hypot(e.clientX-start.x,e.clientY-start.y)<5)return;this.drag=k;const over=document.elementFromPoint(e.clientX,e.clientY)?.closest('[data-block]');target=over?.dataset.block;this.grid.querySelectorAll('.db-target').forEach(el=>el.classList.remove('db-target'));if(target&&target!==k)over.classList.add('db-target');});
    const finish=e=>{if(!start)return;start=null;this.grid.querySelectorAll('.db-target').forEach(el=>el.classList.remove('db-target'));if(this.drag&&target&&target!==k){const t=this.layout.thu_tu,j=t.indexOf(target);t.splice(t.indexOf(k),1);t.splice(j,0,k);this.drag=null;this.save();this.render();}this.drag=null;target=null;};
    handle.addEventListener('pointerup',finish);handle.addEventListener('pointercancel',()=>{start=null;target=null;this.drag=null;this.grid.querySelectorAll('.db-target').forEach(el=>el.classList.remove('db-target'));});
    const move=n=>{const t=this.layout.thu_tu,i=t.indexOf(k),j=i+n;if(j<0||j>=t.length)return;[t[i],t[j]]=[t[j],t[i]];this.save();this.render();this.grid.querySelector(`[data-block="${k}"] .db-handle`)?.focus();};
    return h('div',{class:'db-controls'},handle,btn('Lên',()=>move(-1)),btn('Xuống',()=>move(1)),select(`Cỡ khối ${BLOCKS[k]}`,[['nho','Nhỏ'],['vua','Vừa'],['rong','Rộng']],this.layout.kich_thuoc[k],v=>{this.layout.kich_thuoc[k]=v;this.save();this.render();}));
  }
  updateBlock(k){const body=this.grid?.querySelector(`[data-block="${k}"] .db-body`);if(body){if(k==='xu-huong'){this.charts.forEach(c=>c.destroy());this.charts=[];}thay(body);this.fill(k,body);}}
  fill(k,el){if(k==='viec')this.tasks(el);if(k==='su-co')this.incidents(el);if(k==='van-hanh')this.flow(el);if(k==='tri-nho')this.memories(el);if(k==='xu-huong')this.trends(el);}
  async patchTask(v,data){this.busy=true;try{await api(`/api/viec/${v.id}`,{method:'PATCH',body:JSON.stringify(data)});bao('Đã cập nhật việc.');await this.refresh(true);}catch(e){bao(e.message,{loi:true});}finally{this.busy=false;}}
  tasks(el){
    const mode=this.taskMode||'all';el.append(h('div',{class:'db-row'},select('Nhóm việc',[['all','Tất cả việc đang mở'],['overdue','Quá hạn'],['today','Hôm nay'],['priority','Ưu tiên cao'],['done','Đã xong hôm nay']],mode,v=>{this.taskMode=v;this.refresh(true);}),link('Mở danh sách việc','#viec')));
    if(mode==='done'){el.append(msg(`${this.core.so_lieu.xong_hom_nay||0} việc đã xong hôm nay.`),btn('Xem các việc đã xong',()=>this.details('xong',this.core.hom_nay)));return;}
    const ds=(this.core.viec||[]).filter(v=>mode==='all'||mode==='overdue'&&v.han_ngay&&v.han_ngay<this.core.hom_nay||mode==='today'&&v.han_ngay===this.core.hom_nay||mode==='priority'&&v.uu_tien==='cao');
    if(!ds.length){el.append(msg('Không có việc trong nhóm này.'));return;}
    el.append(h('div',{class:'db-task-list'},...ds.slice(0,30).map(v=>{
      const overdue=v.han_ngay&&v.han_ngay<this.core.hom_nay;
      return h('article',{class:`db-task ${overdue?'db-overdue':''}`},h('button',{class:'db-check','aria-label':`Hoàn thành ${v.tieu_de}`,onclick:()=>this.patchTask(v,{trang_thai:'xong'})},h('span',{'aria-hidden':'true'},'')),
        h('div',{class:'db-task-main'},btn(v.tieu_de,()=>moNganViec(v),'db-task-title'),h('div',{class:'db-task-meta'},h('span',{},v.du_an_ten||'Chưa xếp dự án'),h('span',{class:overdue?'db-red':''},v.han_ngay?`${overdue?'Quá hạn · ':''}${v.han_ngay.split('-').reverse().join('/')}${v.gio_hen?' · '+v.gio_hen:''}`:'Chưa đặt hạn'))),
        h('div',{class:'db-task-actions'},select(`Ưu tiên ${v.tieu_de}`,[['cao','Cao'],['vua','Vừa'],['thap','Thấp']],v.uu_tien||'vua',p=>this.patchTask(v,{uu_tien:p})),btn('Đổi hạn',()=>moNganViec(v))));
    })));
    if(ds.length>30)el.append(link('Mở danh sách việc đầy đủ','#viec'));
  }
  incidents(el){
    if(!this.health){el.append(msg(this.healthError||'Đang đọc tình trạng hệ thống…'));return;}
    const tp=this.health?.thanh_phan||[], live=tp.filter(p=>p.den==='do'||p.den==='vang'),off=tp.filter(p=>p.den==='xam');
    el.append(h('div',{class:`db-health-summary ${live.length?'db-alert':'db-healthy'}`},h('i',{}),h('strong',{},live.length?`${live.length} bộ phận cần xem`:'Các bộ phận đang ổn'),h('span',{},'Toàn hệ thống')));
    for(const p of live)el.append(this.healthRow(p));
    const ai=this.core.ai;if(ai?.canh_bao)el.append(h('div',{class:'db-note'},h('b',{},ai.canh_bao.da_hoi_phuc?'Cảnh báo AI cũ, luồng đã chạy lại':'Cảnh báo AI gần nhất'),h('p',{},ai.canh_bao.noi_dung),h('small',{},`${date(ai.canh_bao.lan_cuoi)}${ai.canh_bao.da_hoi_phuc?' · Có thể đã dùng dự phòng':''}`)));
    const q=this.core.hang_cho||{};el.append(h('div',{class:'db-queue'},h('span',{},'Tin chờ xử lý'),h('b',{},String(q.tin_cho||0)),h('span',{},'Tin lỗi'),h('b',{class:q.tin_loi?'db-red':''},String(q.tin_loi||0))));
    if(q.dang_xu_ly)el.append(h('p',{class:'db-caption'},`${q.dang_xu_ly} tin đang xử lý · Bắt đầu cũ nhất ${date(q.xu_ly_cu_nhat)}`));
    if(q.cu_nhat)el.append(h('p',{class:`db-caption ${Date.now()-Date.parse(q.cu_nhat)>15*60000?'db-red':''}`},`${Date.now()-Date.parse(q.cu_nhat)>15*60000?'Hàng chờ chậm hơn 15 phút · ':''}Tin chờ lâu nhất: ${date(q.cu_nhat)}`));
    const active=(this.core.lan_chay||[]).filter(r=>r.trang_thai==='loi');
    for(const r of active)el.append(h('div',{class:'db-note db-red'},h('b',{},`Lỗi lần chạy: ${r.tac_vu}`),h('p',{},r.ghi_chu||'Không có chi tiết'),h('small',{},date(r.bat_dau))));
    const past=this.core.canh_bao_cu||[];
    if(past.length)el.append(h('details',{},h('summary',{},`${past.length} lỗi cũ đã có lượt chạy thành công sau đó`),...past.map(r=>h('div',{class:'db-note'},h('b',{},r.tac_vu),h('p',{},r.ghi_chu||'Không có chi tiết'),h('small',{},`${date(r.bat_dau)} · Hồi phục ${date(r.hoi_phuc_luc)}`)))));
    if(off.length)el.append(h('details',{},h('summary',{},`${off.length} chức năng chưa bật hoặc chưa nối`),...off.map(p=>this.healthRow(p))));
    el.append(h('div',{class:'db-row'},link('Nhật ký chạy','#nhat-ky'),link('Quản lý kết nối','#ket-noi')));
  }
  healthRow(p){return h('div',{class:'db-health-row'},h('span',{class:`db-dot db-dot-${p.den}`}),h('div',{},h('b',{},p.ten),h('p',{},p.mo_ta),h('small',{},p.lan_cuoi?`Tín hiệu ${date(p.lan_cuoi)}`:'Chưa có thời điểm tín hiệu')));}
  flow(el){
    const tp=this.health?.thanh_phan||[];
    const node=(id,title,caption,component)=>{let p=tp.find(x=>x.ma===component);if(id==='ai'&&this.core.ai?.api_da_cau_hinh&&p?.den==='xam')p={...p,den:'vang',mo_ta:'Đã cấu hình API; chưa có kết quả kiểm tra riêng.'};return btn(h('span',{},h('span',{class:'db-node-top'},h('i',{class:`db-dot db-dot-${p?.den||'xam'}`}),title),h('small',{},caption)),()=>this.flowDetail(id,title,p),'db-node');};
    const stage=(label,...nodes)=>h('div',{class:'db-stage'},h('p',{class:'db-stage-label'},label),...nodes);
    el.append(h('p',{class:'db-caption'},'Bấm một khâu để xem trạng thái và bằng chứng. Luồng này không tự chạy thêm tác vụ.'),h('div',{class:'db-flow'},
      stage('Nguồn tin',node('zalo','Zalo','Tin và tệp','zalo'),node('google','Gmail','Thư mới','google')),
      stage('Tiếp nhận',node('queue','Hộp tin',`${this.core.hang_cho?.tin_cho||0} tin chờ`,'csdl')),
      stage('Xử lý',node('ai','AI qua API',aiCaption(this.core.ai),'ai')),
      stage('Kết quả',node('tasks','Việc',`${this.core.so_lieu.viec_mo||0} việc mở · theo bộ lọc`,'csdl'),node('memory','Trí nhớ','Duyệt và phản hồi','csdl')),
      stage('Đồng bộ',node('google','Tasks và Lịch','Theo kết nối Google','google'),node('drive','Drive','Kho và bản sao','tep'),node('telegram','Thông báo','Telegram và trình duyệt','telegram'))));
    el.append(h('div',{class:'db-feedback'},h('span',{},'Anh sửa việc / duyệt trí nhớ'),h('span',{},'→ Ngữ cảnh cho lượt AI sau'),h('span',{},'Bài học second-brain chỉ được đề xuất, không tự áp dụng')),link('Mở sơ đồ Luồng đầy đủ','#luong'));
  }
  flowDetail(id,title,p){
    const map={zalo:'canh-zalo',google:'dong-bo-google',queue:'tach-viec',ai:'tach-viec',tasks:'canh-viec',memory:'tach-viec',drive:'luu-kho',telegram:'nhac-viec'};
    const runs=(this.core.lan_chay||[]).filter(r=>r.tac_vu===map[id]);
    this.dialog(title,h('div',{},p?this.healthRow(p):msg('Chưa có tín hiệu riêng cho khâu này.'),id==='ai'?h('p',{},`${aiCaption(this.core.ai)} Không dùng Claude Code hoặc gói Max.`):null,
      id==='queue'?h('p',{},`${this.core.hang_cho?.tin_cho||0} tin chờ, ${this.core.hang_cho?.tin_loi||0} tin lỗi. Cũ nhất: ${date(this.core.hang_cho?.cu_nhat)}`):null,
      ...runs.map(r=>h('div',{class:'db-note'},h('b',{},r.trang_thai),h('p',{},r.ghi_chu||''),h('small',{},`${date(r.bat_dau)} · Kết thúc ${date(r.ket_thuc)}`))),!runs.length?msg('Chưa có lần chạy được ghi cho khâu này.'):null,link('Xem nhật ký','#nhat-ky')));
  }
  dialog(title,body){const close=()=>{dialog.close();dialog.remove();};const dialog=h('dialog',{class:'db-dialog','aria-label':title},h('header',{},h('h2',{},title),btn('Đóng',close)),body);dialog.addEventListener('cancel',()=>dialog.remove());dialog.addEventListener('click',e=>{if(e.target===dialog)close();});dialog.querySelectorAll('a').forEach(a=>a.addEventListener('click',close));document.body.append(dialog);dialog.showModal();return dialog;}
  memories(el){
    if(!this.memory){el.append(msg(this.memoryError||'Đang đọc trí nhớ và bài học…'));return;}
    const m=this.memory, sb=m.second_brain||{trang_thai:'unconfigured',ds:[]};
    const q=h('input',{type:'search',placeholder:'Tìm trí nhớ và bài học','aria-label':'Tìm trí nhớ và bài học',value:this.query});
    const rows=h('div',{class:'db-memory-list'});
    const render=()=>{
      const query=this.query.toLocaleLowerCase('vi');const ds=[...(m.ghi_nho||[]).map(g=>({...g,key:g.id,origin:'sonicplan',title:g.tieu_de,body:g.noi_dung})),...(sb.ds||[]).map(g=>({...g,key:g.duong_dan,origin:'second-brain',title:g.tieu_de,body:g.noi_dung}))].filter(g=>(this.sources==='all'||g.origin===this.sources)&&`${g.title} ${g.body}`.toLocaleLowerCase('vi').includes(query));
      thay(rows,...ds.slice(0,10).map(g=>h('button',{class:'db-memory-item',onclick:()=>this.memoryDetail(g)},h('span',{class:'db-memory-source'},g.origin==='sonicplan'?'Sonicplan':'second-brain',g.origin==='sonicplan'?` · ${g.da_duyet?'Đã duyệt':'Chưa duyệt'}`:''),h('b',{},g.title),h('span',{},String(g.body||'').slice(0,110)),h('small',{},date(g.cap_nhat_luc)))));
      if(!ds.length)rows.append(msg('Chưa có nội dung phù hợp.'));
      if(ds.length>10)rows.append(h('p',{class:'db-caption'},`Hiện 10/${ds.length} mục. Dùng tìm kiếm để thu hẹp.`));
    };
    q.addEventListener('input',()=>{this.query=q.value;render();});
    el.append(h('div',{class:'db-row'},select('Nguồn trí nhớ',[['all','Tất cả nguồn'],['sonicplan','Sonicplan'],['second-brain','second-brain']],this.sources,v=>{this.sources=v;render();}),q));
    el.append(h('p',{class:`db-caption ${sb.trang_thai==='ok'?'':'db-red'}`},sb.trang_thai==='ok'?`second-brain · Đọc ${date(sb.doc_luc)}`:sb.trang_thai==='stale'?`second-brain chưa cập nhật · Bản gần nhất ${date(sb.doc_luc)}`:own()?'second-brain chưa được cấu hình cho tổ chức này.':'second-brain chỉ dành cho chủ tổ chức.'));
    el.append(rows);render();
    const lessons=m.bai_hoc||[];
    if(lessons.length)el.append(h('details',{},h('summary',{},`Phản hồi từ ${lessons.length} lần sửa việc gần đây`),...lessons.slice(0,10).map(g=>h('div',{class:'db-note'},h('p',{},g.noi_dung||g.tieu_de||''),h('small',{},date(g.luc||g.tao_luc))))));
    if(own())el.append(h('details',{},h('summary',{},`Đề xuất bài học (${this.proposals.length})`),...this.proposals.map(p=>btn(`${p.tieu_de||p.nguon} · ${p.trang_thai}`,()=>this.proposalDialog(p)))));
    el.append(link('Quản lý toàn bộ trí nhớ','#ghi-nho'));
  }
  memoryDetail(g){const title=h('input',{value:g.title,'aria-label':'Tiêu đề trí nhớ'}),text=h('textarea',{'aria-label':'Nội dung trí nhớ',rows:12},g.body||'');
    const body=h('div',{},h('p',{class:'db-caption'},g.origin==='second-brain'?`${g.duong_dan} · Phiên bản ${g.phien_ban?.slice(0,12)} · Đọc ${date(g.doc_luc)}`:`Sonicplan · ${g.da_duyet?'Đã duyệt':'Chưa duyệt'} · Cập nhật ${date(g.cap_nhat_luc)}`));
    if(g.origin==='sonicplan'){body.append(title,text,h('div',{class:'db-row'},btn('Lưu và duyệt',async()=>{try{await api(`/api/ghi-nho/${g.id}`,{method:'PATCH',body:JSON.stringify({tieu_de:title.value,noi_dung:text.value,da_duyet:true})});d.close();d.remove();await this.loadExtras();bao('Đã lưu trí nhớ.');}catch(e){bao(e.message,{loi:true});}})));}
    else{body.append(h('pre',{class:'db-markdown',text:g.body}),own()?btn('Soạn đề xuất bài học',()=>{d.close();d.remove();this.proposalDialog({nguon:g.duong_dan,truoc:g.body,sau:g.body,tieu_de:g.title,phien_ban:g.phien_ban});}):null);}
    const d=this.dialog(g.title,body);
  }
  proposalDialog(p){
    const title=h('input',{'aria-label':'Tiêu đề đề xuất',value:p.tieu_de||''}),before=h('textarea',{rows:7,readonly:true,'aria-label':'Bản trước'},p.truoc||''),after=h('textarea',{rows:10,'aria-label':'Bản đề xuất'},p.sau||''),selected=h('textarea',{rows:3,'aria-label':'Nội dung chọn gửi AI',placeholder:'Chỉ đoạn anh muốn gửi cho API để soạn đề xuất'}),status=h('p',{class:'db-caption',role:'status'});
    let id=p.id,version=p.phien_ban;
    const save=async state=>{try{const data={tieu_de:title.value,nguon:p.nguon,truoc:before.value,sau:after.value,phien_ban:version,trang_thai:state};const r=await api(`/api/dashboard/proposals${id?'/'+id:''}`,{method:id?'PATCH':'POST',body:JSON.stringify(data)});id=r.id||r.de_xuat?.id||id;status.textContent=state==='approved'?'Đã duyệt bản đề xuất. Chưa sửa second-brain.':'Đã lưu bản đề xuất.';this.loadExtras();}catch(e){status.textContent=e.message;}};
    const download=()=>{const u=URL.createObjectURL(new Blob([after.value],{type:'text/markdown;charset=utf-8'}));const a=h('a',{href:u,download:'de-xuat-bai-hoc.md'});a.click();setTimeout(()=>URL.revokeObjectURL(u),1000);};
    this.dialog('Đề xuất bài học',h('div',{},h('p',{class:'db-caption'},`${p.nguon||''} · Chỉ lưu trong Sonicplan, không ghi second-brain.`),h('label',{},'Tiêu đề',title),h('label',{},'Bản trước',before),h('label',{},'Bản đề xuất',after),h('details',{},h('summary',{},'Nhờ API soạn từ đoạn được chọn'),h('p',{},'Dán đoạn cần gửi vào ô dưới. Chỉ đoạn này được gửi tới API đã cấu hình khi bấm Soạn bằng API.'),selected,btn('Soạn bằng API',async e=>{const button=e.currentTarget;button.disabled=true;status.textContent='Đang gọi API…';try{const r=await api('/api/dashboard/proposals/ai',{method:'POST',body:JSON.stringify({noi_dung:selected.value})});after.value=r.noi_dung||r.sau||r.de_xuat||'';status.textContent='Đã soạn. Anh xem lại trước khi lưu.';}catch(err){status.textContent=err.message;}finally{button.disabled=false;}})),status,h('div',{class:'db-row'},btn('Lưu nháp',()=>save('draft')),btn('Duyệt đề xuất',()=>save('approved'),'db-primary'),btn('Từ chối',()=>save('rejected')),btn('Sao chép',async()=>{try{await navigator.clipboard.writeText(after.value);status.textContent='Đã sao chép.';}catch{status.textContent='Không chép được. Anh có thể tải bản đề xuất.';}}),btn('Tải bản đề xuất',download))));
  }
  async details(kind,day){
    const body=h('div',{},msg('Đang đọc danh sách…'));const d=this.dialog(`${({tin:'Tin đã xử lý',viec:'Việc đã tạo',xong:'Việc đã xong',loi:'Lỗi'})[kind]} · ${day}`,body);
    try{const r=await api(`/api/dashboard/details?kind=${kind}&ngay=${day}&du_an=${this.filter}`);if(!d.isConnected)return;thay(body,...r.ds.map(v=>h('div',{class:'db-note'},kind==='loi'?h('b',{},v.tac_vu||v.tieu_de):link(v.tieu_de||v.noi_dung||`Tin ${v.id}`,kind==='tin'?`#hop-tin/${v.id}`:`#viec/${v.id}`),kind==='loi'?h('p',{},v.ghi_chu||''):null)));if(!r.ds.length)body.append(msg('Không có mục trong ngày và bộ lọc này.'));body.append(link('Mở danh sách đầy đủ',kind==='loi'?'#nhat-ky':kind==='tin'?'#hop-tin':'#viec'));body.querySelectorAll('a').forEach(a=>a.addEventListener('click',()=>{d.close();d.remove();}));}
    catch(e){thay(body,msg(e.message));}
  }
  trends(el){
    el.append(h('div',{class:'db-row'},h('span',{class:'db-caption'},'Việc theo bộ lọc dự án · Tin và lỗi toàn hệ thống'),select('Khoảng xu hướng',[[7,'7 ngày'],[30,'30 ngày']],this.days,v=>{this.days=Number(v);this.loadHistory();})));
    if(!this.history){el.append(msg(this.historyError||'Đang tải xu hướng…'));return;}
    const ds=this.history.ds||[];const canvas=h('canvas',{role:'img','aria-label':'Xu hướng tin đã xử lý, việc tạo, việc xong và lỗi theo ngày'});el.append(h('div',{class:'db-chart'},canvas));
    const table=h('table',{class:'db-trend-table'},h('caption',{},'Số liệu theo ngày'),h('thead',{},h('tr',{},...['Ngày','Tin','Việc tạo','Xong','Lỗi'].map(t=>h('th',{scope:'col'},t)))),h('tbody',{},...ds.map(r=>h('tr',{},h('td',{},r.ngay),...['tin','viec','xong','loi'].map(k=>h('td',{},btn(String(r[k]||0),()=>this.details(k,r.ngay),'db-number')))))));
    el.append(h('details',{},h('summary',{},'Xem bảng số liệu'),table));
    if(!chartLib)chartLib=new Promise((resolve,reject)=>{if(window.Chart)return resolve(window.Chart);const script=h('script',{src:'/vendor/chartjs/chart.umd.min.js',onload:()=>resolve(window.Chart),onerror:()=>reject(new Error('Không tải được biểu đồ'))});document.head.append(script);});
    chartLib.then(Chart=>{if(!this.active()||!canvas.isConnected)return;const cs=getComputedStyle(this.root);this.charts.push(new Chart(canvas,{type:'line',data:{labels:ds.map(r=>r.ngay.slice(5).split('-').reverse().join('/')),datasets:[['tin','Tin đã xử lý','#8a8d98'],['viec','Việc tạo','#00756f'],['xong','Việc xong','#3478f6'],['loi','Lỗi','#c14d43']].map(([key,label,color])=>({label,data:ds.map(r=>r[key]||0),borderColor:color,backgroundColor:color,borderWidth:2,tension:.25,pointRadius:2}))},options:{responsive:true,maintainAspectRatio:false,animation:false,plugins:{legend:{position:'bottom',labels:{color:cs.getPropertyValue('--chu'),boxWidth:10,usePointStyle:true}}},scales:{x:{grid:{display:false},ticks:{maxTicksLimit:8,color:cs.getPropertyValue('--phu')}},y:{beginAtZero:true,ticks:{precision:0,color:cs.getPropertyValue('--phu')},grid:{color:cs.getPropertyValue('--vach')}}},onClick:(e,elements)=>{if(elements.length){const p=elements[0];this.details(['tin','viec','xong','loi'][p.datasetIndex],ds[p.index].ngay);}}}}));}).catch(e=>{canvas.replaceWith(msg(e.message));chartLib=null;});
  }
}
