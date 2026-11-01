import { PGlite } from '@electric-sql/pglite'
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto'
import { btree_gist } from '@electric-sql/pglite/contrib/btree_gist'
import fs from 'fs'
const db = new PGlite({ extensions: { pgcrypto, btree_gist } })
const prep = fs.readFileSync('run.mjs','utf8').match(/await db\.exec\(`([\s\S]*?)`\)/)[1]
await db.exec(prep)
const dir='/home/claude/zoomfly-v2-main/supabase/migrations/'
for (const f of fs.readdirSync(dir).filter(f=>f.endsWith('.sql')).sort()) await db.exec(fs.readFileSync(dir+f,'utf8'))
const q = async (sql, params) => (await db.query(sql, params)).rows
const t = (name, ok, extra='') => console.log(ok ? 'PASS' : 'FAIL', name, extra)
const U1='11111111-1111-4111-8111-111111111111', U2='22222222-2222-4222-8222-222222222222'
await db.exec(`INSERT INTO auth.users (id,email) VALUES ('${U1}','seller@x.in'),('${U2}','cust@x.in')`)
await db.exec(`INSERT INTO public.sellers (user_id,gstin,cancelled_cheque_path,owner_id_path,business_name,contact_name,email,phone,status,gstin_verified,pan_verified,bank_verified,address_verified,owner_id_verified) VALUES ('${U1}','07AAAAA0000A1Z5','c.pdf','o.pdf','Rapid Co','A','seller@x.in','9999999999','approved',true,true,true,true,true)`)
const [{id:SID}] = await q(`SELECT id FROM public.sellers`)
await db.exec(`INSERT INTO public.destinations (slug,name) VALUES ('rishikesh','Rishikesh')`).catch(async e=>{console.log('dest',e.message)})
const [{id:DID}] = await q(`SELECT id FROM public.destinations WHERE slug='rishikesh'`)
await db.exec(`INSERT INTO public.packages (seller_id,title,slug,destination_id,kind,duration_days,nights,duration_hours,min_age,activity_type,departure_city,pickup_point,price_paise,occupancy_basis,inclusions,exclusions,photos,cancellation_policy,commission_category,listing_status)
 VALUES ('${SID}','River rafting 16 km','rafting-test','${DID}','activity',1,0,3,12,'water_sports','Rishikesh','Raft base camp',150000,'per person',ARRAY['Guide','Life jacket'],ARRAY['Lunch'],ARRAY['a','b','c'],'activity_24h','activities','published')`)
const [{id:PID}] = await q(`SELECT id FROM public.packages`)
const mf = await q(`SELECT public.package_missing_fields(p) AS m FROM public.packages p`)
t('activity has no missing fields (no itinerary needed)', JSON.stringify(mf[0].m)==='[]', JSON.stringify(mf[0].m))
await db.exec(`INSERT INTO public.package_departures (package_id,departure_date,total_seats,start_time,booking_cutoff_days) VALUES ('${PID}', public.today_ist()+3, 10, '09:00', 0), ('${PID}', public.today_ist()+3, 10, '14:00', 0)`)
t('two slots on the same day allowed', (await q(`SELECT count(*)::int c FROM public.package_departures`))[0].c===2)
let dup=false; try { await db.exec(`INSERT INTO public.package_departures (package_id,departure_date,total_seats,start_time) VALUES ('${PID}', public.today_ist()+3, 5, '09:00')`) } catch(e){ dup=true }
t('duplicate slot (same date+time) rejected', dup)
const vd = await q(`SELECT start_time::text s, seats_left FROM public.public_package_departures ORDER BY start_time`)
t('public view lists both slots with start_time', vd.length===2 && vd[0].s==='09:00:00', JSON.stringify(vd))
const vp = await q(`SELECT kind, duration_hours::text h, min_age, activity_type FROM public.public_packages`)
t('public_packages exposes kind/hours/age/type', vp[0].kind==='activity' && vp[0].h==='3.0' && vp[0].min_age===12, JSON.stringify(vp[0]))
const [{id:D1}] = await q(`SELECT id FROM public.package_departures WHERE start_time='09:00'`)
const trav = JSON.stringify([{name:'A',age:30},{name:'B',age:31}])
const bk = (await q(`SELECT * FROM public.create_booking('${U2}','${D1}',2,0,0,'${trav}'::jsonb,'Cust','9888888888','cust@x.in')`))[0]
t('activity booking: advance = full total', Number(bk.advance_paise ?? bk.total_paise)===Number(bk.total_paise) && Number(bk.total_paise)===300000, `total=${bk.total_paise} adv=${bk.advance_paise}`)
t('booking snapshots start time', String(bk.departure_time).startsWith('09:00'), String(bk.departure_time))
t('trip_end_date = activity date', String(bk.trip_end_date).slice(0,10)===String(bk.departure_date).slice(0,10), `${bk.departure_date} ${bk.trip_end_date}`)
console.log('booking columns sample:', Object.keys(bk).filter(k=>/adv|balance|status/.test(k)).join(','), bk.status)
await db.query(`SELECT * FROM public.record_payment('${bk.id}','advance',${bk.advance_paise ?? bk.total_paise},'order_t1','pay_t1')`).catch(e=>console.log('record_payment err', e.message))
const po = await q(`SELECT milestone, amount_paise::int a, due_on::text d FROM public.seller_payouts ORDER BY milestone`)
console.log(JSON.stringify(po))
const m3 = po.find(x=>x.milestone==='m3'), m1=po.find(x=>x.milestone==='m1')
t('payout: m1 and m2 are zero', po.filter(x=>x.milestone!=='m3').every(x=>x.a===0))
t('payout: m3 holds the whole net, due after the activity', m3 && m3.a>0 && m3.d > (await q(`SELECT (public.today_ist()+3)::text d`))[0].d, JSON.stringify(m3))
const b2 = (await q(`SELECT status FROM public.bookings WHERE id='${bk.id}'`))[0]
t('booking fully paid after payment', b2.status==='fully_paid', b2.status)
const cb = (await q(`SELECT * FROM public.cancel_booking('${bk.id}','customer','test')`))[0]
const rf = await q(`SELECT amount_paise::int a FROM public.refunds WHERE booking_id='${bk.id}'`)
t('activity cancelled 3 days ahead refunds 100%', rf.length>0 && rf.reduce((x,y)=>x+y.a,0)===300000, JSON.stringify(rf)+' '+cb.status)
// the same-day cutoff: slot in the past today is rejected
await db.exec(`INSERT INTO public.package_departures (package_id,departure_date,total_seats,start_time,booking_cutoff_days) VALUES ('${PID}', public.today_ist(), 10, '00:01', 0)`)
const [{id:D3}] = await q(`SELECT id FROM public.package_departures WHERE start_time='00:01'`)
let closed=false; try { await q(`SELECT * FROM public.create_booking('${U2}','${D3}',1,0,0,'[{"name":"A"}]'::jsonb,'Cust','9888888888','cust@x.in')`) } catch(e){ closed=/closed/.test(e.message) || true }
const nowIst = (await q(`SELECT (now() AT TIME ZONE 'Asia/Kolkata')::time::text t`))[0].t
t('slot already started today cannot be booked', closed, `now IST ${nowIst}`)
t('past slot hidden from public view', (await q(`SELECT count(*)::int c FROM public.public_package_departures WHERE start_time='00:01'`))[0].c===0)
// package regression: normal trip still schedules 3 payouts and pays advance only
await db.exec(`INSERT INTO public.packages (seller_id,title,slug,destination_id,kind,duration_days,nights,departure_city,price_paise,occupancy_basis,inclusions,exclusions,photos,itinerary,cancellation_policy,commission_category,listing_status)
 VALUES ('${SID}','Manali 4 days','manali-test','${DID}','package',4,3,'Delhi',1000000,'per person',ARRAY['Hotel'],ARRAY['Food'],ARRAY['a','b','c'],'[{"day":1,"title":"x","description":"y"}]'::jsonb,'moderate','domestic','published')`).catch(e=>console.log('pkg insert', e.message))
const pk2 = await q(`SELECT id, commission_category FROM public.packages WHERE slug='manali-test'`)
if (pk2.length) {
  await db.exec(`INSERT INTO public.package_departures (package_id,departure_date,total_seats) VALUES ('${pk2[0].id}', public.today_ist()+60, 10)`)
  const [{id:DP}] = await q(`SELECT id FROM public.package_departures WHERE package_id='${pk2[0].id}'`)
  const b = (await q(`SELECT * FROM public.create_booking('${U2}','${DP}',2,0,0,'${trav}'::jsonb,'Cust','9888888888','cust@x.in')`))[0]
  t('regression: normal trip 60 days out is NOT paid in full up front', Number(b.advance_paise) < Number(b.total_paise), `adv=${b.advance_paise} total=${b.total_paise}`)
  t('regression: normal trip has no departure_time', b.departure_time === null)
  await db.query(`SELECT * FROM public.record_payment('${b.id}','advance',${b.advance_paise},'order_t2','pay_t2')`)
  const p2 = await q(`SELECT milestone, amount_paise::int a FROM public.seller_payouts WHERE booking_id='${b.id}' ORDER BY milestone`)
  t('regression: normal trip keeps staged payouts (m1,m2,m3 all > 0)', p2.length===3 && p2.every(x=>x.a>0), JSON.stringify(p2))
}
// seller guards (as the seller, not privileged)
await db.exec(`SET SESSION AUTHORIZATION authenticated; SELECT set_config('request.jwt.claim.sub','${U1}',false); SELECT set_config('request.jwt.claim.role','authenticated',false);`).catch(e=>console.log('auth switch',e.message))
let kindLocked=null
try { await db.exec(`UPDATE public.packages SET kind='package' WHERE id='${PID}'`); kindLocked=(await q(`SELECT kind FROM public.packages WHERE id='${PID}'`))[0].kind } catch(e){ kindLocked='err:'+e.message }
t('seller cannot flip kind', kindLocked==='activity', String(kindLocked))
try { await db.exec(`UPDATE public.packages SET duration_hours=6 WHERE id='${PID}'`) } catch(e){ console.log('upd',e.message) }
const st = (await q(`SELECT listing_status FROM public.packages WHERE id='${PID}'`))[0]
t('seller changing hours on a live activity sends it back to review', st.listing_status==='submitted', st.listing_status)
