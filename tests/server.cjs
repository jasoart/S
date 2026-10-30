const http=require('node:http'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..');
const mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.webmanifest':'application/manifest+json','.svg':'image/svg+xml','.png':'image/png','.json':'application/json'};
http.createServer((req,res)=>{
  const url=new URL(req.url,'http://localhost');
  if(!url.pathname.startsWith('/S/')){res.writeHead(404).end();return;}
  const relative=decodeURIComponent(url.pathname.slice(3));const target=path.resolve(root,relative||'index.html');
  if(!target.startsWith(root+path.sep)){res.writeHead(403).end();return;}
  fs.readFile(target,(err,body)=>{if(err){res.writeHead(404).end('Not found');return;}res.writeHead(200,{'Content-Type':mime[path.extname(target)]||'text/plain','Cache-Control':'no-cache'}).end(body);});
}).listen(4173,'127.0.0.1');
