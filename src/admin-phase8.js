export async function injectPhase8Admin(response) {
  const html = await response.text();
  const marker = '</script></body></html>';
  if (!html.includes(marker)) return new Response(html, { status: response.status, headers: response.headers });

  const script = `<script>
(()=>{
  const dashboard=document.querySelector('[data-panel="dashboard"] .grid');
  if(!dashboard)return;
  const card=document.createElement('article');card.className='card';
  const pill=document.createElement('span');pill.className='pill';pill.textContent='Phase 8';
  const title=document.createElement('h2');title.textContent='Production readiness';
  const copy=document.createElement('p');copy.textContent='Run a live Cloudflare check for Access, D1, R2, migrations, seeded content, and publication schema.';
  const status=document.createElement('p');status.className='muted';status.textContent='Not checked yet.';
  const button=document.createElement('button');button.type='button';button.className='btn primary';button.textContent='Run production check';button.style.marginTop='14px';
  const details=document.createElement('div');details.className='muted';details.style.marginTop='12px';
  button.addEventListener('click',async()=>{
    button.disabled=true;status.textContent='Checking deployed bindings and schema…';details.replaceChildren();
    try{
      const response=await fetch('/api/admin/production-readiness',{headers:{accept:'application/json'}});
      const data=await response.json();if(!response.ok)throw new Error(data.error||('Readiness check failed ('+response.status+')'));
      status.textContent=data.ready?'Production gate: READY':'Production gate: BLOCKED';
      status.style.color=data.ready?'#72f0bd':'#ffd08a';
      const checks=data.checks||{};
      for(const [name,passed] of Object.entries(checks)){
        const row=document.createElement('div');row.textContent=(passed?'✓ ':'✕ ')+name;row.style.marginTop='5px';details.append(row);
      }
      if(data.blockers?.length){const row=document.createElement('div');row.textContent='Blockers: '+data.blockers.join(', ');row.style.marginTop='10px';details.append(row)}
      const migration=document.createElement('div');migration.textContent='Required migration floor: '+data.requiredMigration;migration.style.marginTop='10px';details.append(migration);
    }catch(error){status.textContent='Production check failed';details.textContent=error.message||String(error)}finally{button.disabled=false}
  });
  card.append(pill,title,copy,status,button,details);dashboard.append(card);
})();
</script>`;
  const next = html.replace(marker, script + marker);
  return new Response(next, { status: response.status, headers: response.headers });
}
