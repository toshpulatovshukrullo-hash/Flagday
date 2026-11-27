import cv2, numpy as np
im=cv2.imread('src.jpg').astype(np.float32)
H,W=im.shape[:2]
pts=np.array([(400,800),(412,860),(420,920),(440,965),(470,1002),(580,1105),(680,1170),(780,1230),(900,1310),(1050,1390),(1170,1450),(1230,1490),(1290,1522),(1809,1780),(1900,1825)],np.float32)
# dense resample
seg=np.r_[0,np.cumsum(np.linalg.norm(np.diff(pts,axis=0),axis=1))]
s=np.arange(0,seg[-1],1.0)
cx=np.interp(s,seg,pts[:,0]); cy=np.interp(s,seg,pts[:,1])
# smooth
k=41; ker=np.ones(k)/k
cxs=np.convolve(np.pad(cx,k//2,mode='edge'),ker,'valid'); cys=np.convolve(np.pad(cy,k//2,mode='edge'),ker,'valid')
tx=np.gradient(cxs); ty=np.gradient(cys); n=np.hypot(tx,ty); tx/=n; ty/=n
nx,ny=-ty,tx  # normal (points to the right of direction => down-left for SE-going)
D=70
d=np.arange(-D,D+1,dtype=np.float32)
mapx=(cxs[:,None]+d[None,:]*nx[:,None]).astype(np.float32)
mapy=(cys[:,None]+d[None,:]*ny[:,None]).astype(np.float32)
strip=cv2.remap(im,mapx,mapy,cv2.INTER_LINEAR,borderMode=cv2.BORDER_REFLECT)
cv2.imwrite('strip.png',np.rot90(strip).astype(np.uint8))
np.savez('path.npz',cx=cxs,cy=cys,nx=nx,ny=ny,D=D)
print(len(s), nx[700],ny[700])
