// Chỉ cấu hình nguồn đọc second-brain cho chủ tổ chức đã xác minh. Không gọi AI.
import { existsSync, readFileSync, writeFileSync, renameSync, statSync } from 'node:fs';
import { homedir } from 'node:os';
import { resolve, join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { docEnv } from '../may-chu/chay.js';
const root=resolve(import.meta.dirname,'..'), file=join(root,'may-chu/.env');
const cfg={...docEnv(file),...process.env};
let dir=cfg.SECOND_BRAIN_DIR;
if(!dir)dir=[join(homedir(),'Brain/second-brain'),join(homedir(),'.sonicplan-tho/second-brain')].find(p=>existsSync(join(p,'memory/context/bai-hoc'))&&existsSync(join(p,'memory/projects')));
if(!dir){console.log('Dashboard: chưa tìm thấy nguồn second-brain; sẽ hiển thị chưa nối.');process.exit(0);}
const dbFile=cfg.DB_FILE?resolve(root,cfg.DB_FILE):resolve(root,cfg.DU_LIEU||'du-lieu','sonicplan.sqlite');
const db=new DatabaseSync(dbFile,{readOnly:true});
const target=cfg.SECOND_BRAIN_TO_CHUC||'tc_namhai';
const owners=db.prepare("SELECT v.to_chuc_id FROM thanh_vien v JOIN nguoi_dung n ON n.id=v.nguoi_dung_id WHERE n.email=? AND v.vai_tro='chu' AND v.to_chuc_id=?").all('hainnam@gmail.com',target);
db.close();
if(owners.length!==1){console.log('Dashboard: chưa xác minh được chủ tổ chức của nguồn second-brain; không đổi cấu hình.');process.exit(0);}
if(/[\r\n]/.test(dir)||/[\r\n]/.test(target))throw new Error('Cấu hình nguồn không hợp lệ.');
const old=existsSync(file)?readFileSync(file,'utf8'):'';
const next=old.split('\n').filter(l=>!/^SECOND_BRAIN_(DIR|TO_CHUC)=/.test(l)).join('\n').trimEnd()+`\nSECOND_BRAIN_DIR=${dir}\nSECOND_BRAIN_TO_CHUC=${target}\n`;
if(next!==old){const mode=existsSync(file)?statSync(file).mode&0o777:0o600;writeFileSync(file+'.dashboard-moi',next,{mode});renameSync(file+'.dashboard-moi',file);}
console.log('Dashboard: nguồn second-brain đã gắn với chủ tổ chức đã xác minh, chỉ đọc.');
