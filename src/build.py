s=open('shell.html').read()
s=s.replace('<script>/*SAMPLE*/</script>','<script>const SAMPLE = '+open('sample.json').read()+';</script>')
s=s.replace('<script>/*APP*/</script>','<script>\n'+(open('app.js').read()+'\n'+'\n'.join(open(f).read() for f in ['pro1.js','pro2.js','pro3.js','pro4.js','pro5.js','pro6.js','pro7.js','pro8.js','decals.js','pro9.js','pro10.js','pro11.js','pro12.js','pro13.js','pro14.js','pro15.js','pro16.js','pro17.js','pro18.js','pro19.js']))+'\n</script>')
open('3d-render.artifact.html','w').write(s)
head='<!doctype html>\n<html lang="ko">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n<style>:root{padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px);box-sizing:border-box}body{margin:0}[hidden]{display:none!important}</style>\n'
body=s.replace('<meta name="claude:viewport-fit-sides" content="cover">\n','')
i=body.index('</style>')+len('</style>')
open('3D-RENDER.html','w').write(head+body[:i]+'\n</head>\n<body>\n'+body[i:]+'\n</body>\n</html>\n')

# 앱(www) 화면: config.js 를 SAMPLE 앞에 넣어 www/index.html 로
w=open('3D-RENDER.html').read()
k=w.index('<script>const SAMPLE')
import os
open(os.path.join('..','www','index.html'),'w').write(w[:k]+'<script src="config.js"></script>\n'+w[k:])
