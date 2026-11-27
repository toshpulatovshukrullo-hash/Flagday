import cv2,numpy as np
from scipy.ndimage import median_filter
p=np.load('path.npz'); D=int(p['D'])
im=cv2.imread('src.jpg')
cx,cy,nx,ny=p['cx'],p['cy'],p['nx'],p['ny']
d=np.arange(-D,D+1,dtype=np.float32)
mx=(cx[:,None]+d[None]*nx[:,None]).astype(np.float32); my=(cy[:,None]+d[None]*ny[:,None]).astype(np.float32)
S=cv2.remap(im,mx,my,cv2.INTER_LINEAR,borderMode=cv2.BORDER_REFLECT)
hsv=cv2.cvtColor(S,cv2.COLOR_BGR2HSV).astype(int); h,s,v=hsv[...,0],hsv[...,1],hsv[...,2]
blue=(h>=95)&(h<=116)&(s>100)&(v>100)
white=(v>165)&(s<48)
L=S.shape[0]; s0,s1=205,1192
top=np.zeros(L); bot=np.zeros(L); ok=np.zeros(L,bool)
for i in range(s0,s1):
    rb=np.where(blue[i,30:113])[0]+30
    rw=np.where(white[i,30:113])[0]+30
    if len(rb)>=3:
        t=rb[min(1,len(rb)-1)]
    elif len(rw)>=6: t=rw[1]
    else: continue
    rw2=rw[(rw>=t)&(rw<=t+75)]
    b=rw2[-2] if len(rw2)>4 else (rb[-1] if len(rb) else t+40)
    top[i]=t; bot[i]=max(b,t+20); ok[i]=True
idx=np.arange(L)
top=np.interp(idx,idx[ok],top[ok]); bot=np.interp(idx,idx[ok],bot[ok])
from scipy.ndimage import minimum_filter
top=minimum_filter(median_filter(top,9),41); bot=median_filter(bot,25)
top=cv2.GaussianBlur(top.reshape(-1,1).astype(np.float32),(1,0),3).ravel() if False else np.convolve(np.pad(top,7,mode='edge'),np.ones(15)/15,'valid')
bot=np.convolve(np.pad(bot,7,mode='edge'),np.ones(15)/15,'valid')
M=np.zeros(S.shape[:2],np.float32)
rows=np.arange(S.shape[1])[None,:]
M=((rows>=top[:,None]-5)&(rows<=bot[:,None]+3)).astype(np.float32)
M[:s0-1]=0; M[s1:]=0
# nose: restrict to colored pixels in last 40 columns
nz=slice(s1-45,s1)
colm=(blue|white)[nz].astype(np.uint8)
colm=cv2.morphologyEx(colm,cv2.MORPH_CLOSE,np.ones((7,7),np.uint8))
M[nz]*=colm
# rear: taper
M=cv2.GaussianBlur(M,(5,5),1.0)
pole=(M>0.5)&~blue&~white&(h>=5)&(h<=30)&(s>25)&(v>70)&(v<200)
pole=cv2.morphologyEx(pole.astype(np.uint8),cv2.MORPH_OPEN,np.ones((2,2),np.uint8))
np.savez('tmask.npz',M=M,pole=pole,top=top,bot=bot)
vis=S.copy().astype(float); vis[M>0.5]=(vis[M>0.5]*0.5+np.array([0,0,255])*0.5); vis[pole>0]=(0,255,0)
vis=vis.astype(np.uint8)
t=np.ascontiguousarray(np.transpose(vis,(1,0,2)))
parts=[np.pad(t[:,i:i+640],((0,6),(0,640-t[:,i:i+640].shape[1]),(0,0))) for i in range(0,1280,640)]
cv2.imwrite('tmask_view.png',cv2.resize(np.vstack(parts),None,fx=2,fy=2,interpolation=cv2.INTER_NEAREST))
