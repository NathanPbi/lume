// Nail Virtual — prévia realista opcional com IA.
// A IA recebe a foto da mão + a máscara das unhas (detectadas no aparelho) e pinta só elas.
// Depois, o app cola de volta SOMENTE as unhas geradas sobre a foto original: pele, anéis e fundo ficam idênticos.
window.NailVirtualPreview = {
  open({side, hands, shape, length, style, local, mask}) {
    const DAY = 86400000, fresh = h => h && Date.now() - h.ts < DAY;
    const sides = ['L', 'R'].filter(k => fresh(hands[k]));
    if (!sides.length) return;
    const dialog = document.createElement('dialog');
    dialog.className = 'aiDlg';
    dialog.setAttribute('aria-label', 'Prévia realista com IA');
    dialog.innerHTML = `
      <div class="dh"><h2>Prévia realista</h2><button class="x" type="button" aria-label="Fechar prévia">×</button></div>
      <div class="db">
        <div class="aiSeg" role="group" aria-label="Mão"></div>
        <div class="aiStage"><img alt="Prévia da esmaltação"><span class="aiTag"></span></div>
        <p class="aiHint muted">Segure a imagem para comparar com a prévia do aparelho.</p>
        <p class="muted aiPriv">Ao gerar, a foto desta mão é enviada ao serviço de imagens da OpenAI. O resultado fica só nesta janela.</p>
        <button type="button" class="wine" data-generate style="width:100%">✨ Gerar prévia realista</button>
        <p role="status" aria-live="polite" class="aiStatus"></p>
      </div>`;
    const seg = dialog.querySelector('.aiSeg'), img = dialog.querySelector('img'), tag = dialog.querySelector('.aiTag');
    const button = dialog.querySelector('[data-generate]'), status = dialog.querySelector('.aiStatus'), hint = dialog.querySelector('.aiHint');
    let cur = sides.includes(side) ? side : sides[0], controller;
    const results = new Map(), localURL = new Map();
    const localOf = k => { if (!localURL.has(k)) localURL.set(k, local(k).toDataURL('image/jpeg', .9)); return localURL.get(k); };
    function display(showLocal) {
      seg.innerHTML = sides.length > 1 ? sides.map(k => `<button data-k="${k}" aria-pressed="${k === cur}">${k === 'L' ? 'Esquerda' : 'Direita'}</button>`).join('') : '';
      seg.querySelectorAll('button').forEach(b => b.onclick = () => { if (!controller) { cur = b.dataset.k; display(); } });
      const r = results.get(cur);
      img.src = r && !showLocal ? r : localOf(cur);
      tag.textContent = r && !showLocal ? 'Prévia com IA' : 'Prévia do aparelho';
      tag.classList.toggle('ai', !!(r && !showLocal));
      hint.style.display = r ? '' : 'none';
      button.style.display = r ? 'none' : '';
      dialog.querySelector('.aiPriv').style.display = r ? 'none' : '';
      button.disabled = !!controller;
    }
    const hold = on => { if (results.has(cur)) display(on); };
    img.addEventListener('pointerdown', () => hold(true));
    ['pointerup', 'pointerleave', 'pointercancel'].forEach(t => img.addEventListener(t, () => hold(false)));
    dialog.querySelector('.x').onclick = () => dialog.close();
    dialog.addEventListener('close', () => { controller?.abort(); for (const u of results.values()) URL.revokeObjectURL(u); dialog.remove(); }, {once: true});

    // cola só as unhas da IA na foto original (máscara suavizada)
    async function composite(k, blob) {
      const h = hands[k], W = h.orig.width, H = h.orig.height;
      const ai = await createImageBitmap(blob);
      if (Math.abs(ai.width / ai.height - W / H) > .03) return URL.createObjectURL(blob); // IA mudou o enquadramento: mostra como veio
      const out = document.createElement('canvas'); out.width = W; out.height = H;
      const o = out.getContext('2d'); o.drawImage(h.src || h.orig, 0, 0, W, H);
      const lay = document.createElement('canvas'); lay.width = W; lay.height = H;
      const l = lay.getContext('2d'); l.drawImage(ai, 0, 0, W, H);
      const m = document.createElement('canvas'); m.width = W; m.height = H;
      const mx = m.getContext('2d'); mx.filter = 'blur(' + Math.max(1.5, W / 520) + 'px)'; mx.drawImage(mask(k, true).mask, 0, 0); mx.filter = 'none';
      if (h.mask) { mx.globalCompositeOperation = 'destination-in'; mx.drawImage(h.mask, 0, 0, W, H); mx.globalCompositeOperation = 'source-over'; }
      l.globalCompositeOperation = 'destination-in'; l.drawImage(m, 0, 0);
      o.drawImage(lay, 0, 0);
      return await new Promise(r => out.toBlob(b => r(URL.createObjectURL(b)), 'image/jpeg', .92));
    }

    button.onclick = async () => {
      const k = cur, hand = hands[k];
      if (controller || results.has(k)) return;
      if (!fresh(hand)) { status.textContent = 'Essa foto expirou. Tire outra para gerar a prévia.'; return; }
      controller = new AbortController(); display();
      status.textContent = 'Gerando a esmaltação com IA… pode levar até um minuto.';
      try {
        const mk = mask(k);
        const response = await fetch('./api/previa-realista', {
          method: 'POST', headers: {'Content-Type': 'application/json'}, signal: controller.signal,
          body: JSON.stringify({photo: hand.jpg, mask: mk.png, side: k, nails: style(k), shape, length})
        });
        if (!response.ok || !response.headers.get('content-type')?.startsWith('image/')) {
          const problem = await response.json().catch(() => null);
          throw Error(problem?.error || 'A prévia precisa do servidor Node incluído no pacote.');
        }
        const blob = await response.blob();
        if (!dialog.open) return;
        results.set(k, await composite(k, blob));
        status.textContent = '';
      } catch (error) {
        if (dialog.open && error.name !== 'AbortError') status.textContent = error instanceof TypeError ? 'Falha de conexão com o servidor da prévia.' : error.message;
      } finally { controller = undefined; if (dialog.open) display(); }
    };
    document.body.append(dialog);
    display();
    dialog.showModal();
  }
};
