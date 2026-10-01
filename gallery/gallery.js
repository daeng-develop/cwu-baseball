import { mountShell, all, escapeHTML } from '../common/common.js';
mountShell();
document.getElementById('app').innerHTML =
  '<div class="page-heading"><div><span class="eyebrow">GALLERY</span><h1>사진 갤러리</h1></div></div><div id="gallery" class="gallery"></div>';
try {
  let photos = (await all('photos')).sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  document.getElementById('gallery').innerHTML = photos.length
    ? photos
        .map(
          (p) =>
            /* HTML */ `<figure>
              <img
                src="${escapeHTML(p.url)}"
                alt="${escapeHTML(p.caption || '야구부 사진')}"
                loading="lazy"
              />
              <figcaption>${escapeHTML(p.caption || '청운대 야구부')}</figcaption>
            </figure>`,
        )
        .join('')
    : '<div class="empty panel">등록된 사진이 없습니다.</div>';
} catch (e) {
  document.getElementById('gallery').textContent = '사진을 불러오지 못했습니다.';
  console.error(e);
}
