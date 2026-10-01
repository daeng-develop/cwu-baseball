// Local development server. Binds to loopback and keeps the KBSA request on this origin.
const http = require('node:http');
const fs = require('node:fs/promises');
const path = require('node:path');
const { randomUUID } = require('node:crypto');

const root = __dirname;
const port = Number(process.env.CWU_PORT || 5500);
const types = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
};

function json(response, status, body) {
  response.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
  });
  response.end(JSON.stringify(body));
}

async function importGame(request, response) {
  if (request.headers['content-type']?.split(';')[0] !== 'application/json') {
    json(response, 415, { error: 'JSON 요청만 처리할 수 있습니다.' });
    return;
  }
  const origin = request.headers.origin;
  if (origin && ![`http://localhost:${port}`, `http://127.0.0.1:${port}`].includes(origin)) {
    json(response, 403, { error: '로컬 페이지에서만 사용할 수 있습니다.' });
    return;
  }
  try {
    let body = '';
    for await (const chunk of request) {
      body += chunk;
      if (body.length > 1000) throw Error('요청이 너무 큽니다.');
    }
    const input = JSON.parse(body);
    const id = String(input.gameIdx || '');
    if (!/^\d{1,10}$/.test(id)) throw Error('경기 ID를 확인해 주세요.');
    const url = `https://www.korea-baseball.com/game/record_detail?game_idx=${id}`;
    const source = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; CWUBaseballLocal/1.0)' },
      signal: AbortSignal.timeout(25000),
    });
    if (!source.ok) throw Error(`협회 페이지 응답: ${source.status}`);
    const html = await source.text();
    if (html.length > 2_000_000) throw Error('협회 페이지가 너무 큽니다.');
    // Reload the parser for each local preview so editing its file does not require restarting Node.
    const parserPath = require.resolve('./functions/kbsa-parser');
    delete require.cache[parserPath];
    const { parseKbsaRecord } = require(parserPath);
    json(response, 200, parseKbsaRecord(html, id, { includeAllTeams: input.mode === 'history' }));
  } catch (error) {
    json(response, 422, { error: error.message });
  }
}

async function uploadImage(request, response) {
  const origin = request.headers.origin;
  if (origin && ![`http://localhost:${port}`, `http://127.0.0.1:${port}`].includes(origin)) {
    json(response, 403, { error: '로컬 페이지에서만 사진을 저장할 수 있습니다.' });
    return;
  }
  if (request.headers['content-type']?.split(';')[0] !== 'image/jpeg') {
    json(response, 415, { error: 'JPG 사진만 저장할 수 있습니다.' });
    return;
  }
  try {
    const params = new URL(request.url, `http://localhost:${port}`).searchParams;
    const year = params.get('year') || '';
    const number = params.get('number') || '';
    const relative =
      /^\d{4}$/.test(year) && /^\d{1,3}$/.test(number) ? `image/players/${year}/${number}.jpg` : '';
    if (!relative) throw Error('사진 저장 경로를 확인해 주세요.');
    const chunks = [];
    let size = 0;
    for await (const chunk of request) {
      size += chunk.length;
      if (size > 8 * 1024 * 1024) throw Error('8MB 이하 JPG만 저장할 수 있습니다.');
      chunks.push(chunk);
    }
    const image = Buffer.concat(chunks);
    if (image.length < 4 || image[0] !== 0xff || image[1] !== 0xd8 || image[2] !== 0xff)
      throw Error('JPG 파일 형식을 확인해 주세요.');
    const target = path.join(root, relative);
    await fs.mkdir(path.dirname(target), { recursive: true });
    const temp = `${target}.${randomUUID()}.tmp`;
    try {
      await fs.writeFile(temp, image);
      await fs.rename(temp, target);
    } finally {
      await fs.rm(temp, { force: true });
    }
    json(response, 200, { path: relative });
  } catch (error) {
    json(response, 422, { error: error.message });
  }
}

async function serveFile(request, response) {
  let pathname;
  try {
    pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
  } catch {
    response.writeHead(400).end();
    return;
  }
  if (pathname === '/') pathname = '/main.html';
  const file = path.resolve(root, '.' + pathname);
  const extension = path.extname(file).toLowerCase();
  if (!file.startsWith(root + path.sep) || !types[extension]) {
    response.writeHead(404).end();
    return;
  }
  try {
    const contents = await fs.readFile(file);
    response.writeHead(200, {
      'Content-Type': types[extension],
      ...(extension === '.jpg' ? { 'Cache-Control': 'no-cache' } : {}),
    });
    response.end(request.method === 'HEAD' ? undefined : contents);
  } catch {
    response.writeHead(404).end();
  }
}

if (!Number.isInteger(port) || port < 1 || port > 65535) throw Error('CWU_PORT를 확인해 주세요.');
http
  .createServer((request, response) => {
    if (request.url === '/api/preview-kbsa-game' && request.method === 'POST') {
      void importGame(request, response);
    } else if (request.url?.startsWith('/api/upload-image?') && request.method === 'POST') {
      void uploadImage(request, response);
    } else if (request.method === 'GET' || request.method === 'HEAD') {
      void serveFile(request, response);
    } else {
      response.writeHead(405).end();
    }
  })
  .listen(port, '127.0.0.1', () => {
    console.log(`청운대 로컬 테스트: http://localhost:${port}/main.html`);
  });
