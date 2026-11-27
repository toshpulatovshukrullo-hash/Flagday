import cv2, numpy as np, sys, os
from scipy.spatial import cKDTree
rng=np.random.default_rng(7)
FPS=30; DUR=20.0; NF=int(FPS*DUR)
OW,OH=1080,1920
X0,X1,TOP=150,1650,619
src=cv2.imread('src.jpg').astype(np.float32)/255.
SH,SW=src.shape[:2]
CW=X1-X0; CH=SH+TOP   # 1500 x 2667

def smooth(e0,e1,x):
    t=np.clip((x-e0)/(e1-e0),0,1); return t*t*(3-2*t)
def fbm(h,w,base,oct=5,seed=0,pers=0.5):
    r=np.random.default_rng(seed); out=np.zeros((h,w),np.float32); a=1; tot=0; sc=base
    for o in range(oct):
        gh,gw=max(2,int(h/sc)+2),max(2,int(w/sc)+2)
        g=r.random((gh,gw)).astype(np.float32)
        up=cv2.resize(g,(int(gw*sc),int(gh*sc)),interpolation=cv2.INTER_CUBIC)[:h,:w]
        out+=a*up; tot+=a; a*=pers; sc/=2
    return out/tot

# ---------------- spring greening (source coords) ----------------
hsv=cv2.cvtColor(src,cv2.COLOR_BGR2HSV)  # H 0..360, S,V 0..1
H,S,V=hsv[...,0],hsv[...,1],hsv[...,2]
cliff=np.zeros((SH,SW),np.uint8)
cliffP=np.array([(1250,330),(1270,150),(1400,85),(1560,90),(1650,180),(1809,280),(1809,1620),(1650,1580),(1450,1520),(1300,1420),(1150,1300),(1030,1150),(985,1000),(1040,820),(1120,640),(1200,480)],np.int32)
cv2.fillPoly(cliff,[cliffP],1); cliff=cv2.GaussianBlur(cliff.astype(np.float32),(0,0),25)
skyraw=((H>=190)&(H<=240)&(S>0.24)&(V>0.47)).astype(np.uint8)
ff=skyraw.copy(); mm=np.zeros((SH+2,SW+2),np.uint8); cv2.floodFill(ff,mm,(10,5),2)
skym=(ff==2).astype(np.float32)
skym=cv2.GaussianBlur(cv2.dilate(skym,np.ones((3,3))),(0,0),1.2)
nz=fbm(SH,SW,220,4,seed=3)
w=np.clip(1-np.abs(H-42)/30,0,1)**0.6 * smooth(0.12,0.35,S) * smooth(0.18,0.35,V)
w*= (1-0.8*cliff)
# distance haze: far hills (top) less saturated green
far=smooth(300,800,np.arange(SH,dtype=np.float32))[:,None]
target=92+ (nz-0.5)*26     # yellow-green..green
Hn=H+(target-H)*w*0.92
Sn=np.clip(S*(1+0.12*w*far)+0.03*w,0,1)
Vn=V*(1-0.22*w)
# lightly green low-sat dry soil on slopes (not riverbed / track) via noise patches
grass2=smooth(0.45,0.6,fbm(SH,SW,60,4,seed=11))*smooth(0.05,0.2,S)*(S<0.25)*(1-cliff)*smooth(560,700,np.arange(SH,dtype=np.float32))[:,None]
g=cv2.cvtColor(np.dstack([Hn,Sn,Vn]).astype(np.float32),cv2.COLOR_HSV2BGR)
green_tint=np.array([0.20,0.52,0.30],np.float32)
g=g*(1-0.22*grass2[...,None])+ (green_tint*g.mean(2,keepdims=True)*1.6)*0.22*grass2[...,None]
# rock: a bit fresher (cooler, some moss)
moss=smooth(0.6,0.78,fbm(SH,SW,40,4,seed=5))*cliff*0.25
g=g*(1-moss[...,None])+np.array([0.16,0.40,0.25],np.float32)*g.mean(2,keepdims=True)*2.0*moss[...,None]
# flowers (poppies & white/yellow) on greened slopes
fl=(w>0.5)&(fbm(SH,SW,80,3,seed=21)>0.6)&(np.arange(SH)[:,None]>950)
ys,xs=np.where(fl); sel=rng.random(len(ys))<0.0035
cols=[(0.10,0.10,0.75),(0.12,0.16,0.80),(0.88,0.88,0.90),(0.2,0.75,0.88)]
for y,x in zip(ys[sel],xs[sel]):
    c=cols[rng.choice(4,p=[0.45,0.2,0.2,0.15])]
    rr=1
    cv2.circle(g,(int(x),int(y)),rr,c,-1,lineType=cv2.LINE_AA)
g=np.clip(g,0,1)
# keep train colours untouched
p=np.load('path.npz'); D=int(p['D']); cx,cy,nxv,nyv=p['cx'],p['cy'],p['nx'],p['ny']
L=len(cx)
tm=np.load('tmask.npz'); M=tm['M'].astype(np.float32)
M[1150:,:45]=0
dd=np.arange(-D,D+1,dtype=np.float32)
mx=(cx[:,None]+dd[None]*nxv[:,None]).astype(np.float32); my=(cy[:,None]+dd[None]*nyv[:,None]).astype(np.float32)
Sorig=cv2.remap(src,mx,my,cv2.INTER_LINEAR,borderMode=cv2.BORDER_REFLECT)
Sg=cv2.remap(g,mx,my,cv2.INTER_LINEAR,borderMode=cv2.BORDER_REFLECT)
T=Sorig*M[...,None]+Sg*(1-M[...,None])   # train layer from original colours
# background with train removed: copy track texture from ahead
B=Sg.copy(); R0,R1=37,116; SHIFT=995
fillw=np.zeros(B.shape[:2],np.float32); fillw[200:1205,R0:R1]=1
fillw=cv2.GaussianBlur(fillw,(0,0),3)
ahead=np.concatenate([Sg[SHIFT+200:],Sg[SHIFT+200:][::-1]],0)
src_rows=np.zeros_like(B)
n=1205-200; tile=ahead[:n] if len(ahead)>=n else np.concatenate([ahead,ahead[::-1]])[:n]
src_rows[200:1205]=tile
B=B*(1-fillw[...,None])+src_rows*fillw[...,None]
SPEED=26.0  # px/s along track (source px)

# image-space (s,d) for band pixels
tree=cKDTree(np.c_[cx,cy])
bx0,by0=int(max(0,cx.min()-80)),int(max(0,cy.min()-80)); bx1,by1=SW,SH
yy,xx=np.mgrid[by0:by1,bx0:bx1].astype(np.float32)
dist,idx=tree.query(np.c_[xx.ravel(),yy.ravel()])
idx=idx.reshape(xx.shape)
txv=np.gradient(cx); tyv=np.gradient(cy); tn=np.hypot(txv,tyv); txv/=tn; tyv/=tn
rx=xx-cx[idx]; ry=yy-cy[idx]
sF=(idx+rx*txv[idx]+ry*tyv[idx]).astype(np.float32)
dF=(rx*nxv[idx]+ry*nyv[idx]).astype(np.float32)
bandA=(smooth(D-2,D-12,np.abs(dF))*((idx>3)&(idx<L-4))).astype(np.float32)
band_mapx=(dF+D).astype(np.float32); band_mapy=sF

# ---------------- river ----------------
im8=(src*255).astype(np.uint8); b_,g_,r_=[im8[...,i].astype(int) for i in range(3)]
P1=(np.array([(20,320),(40,330),(100,380),(150,430),(140,480),(100,540),(60,600),(50,680),(80,780),(110,830),(150,880),(220,920),(300,960),(360,1000),(430,1024),(470,1040)])*2).astype(np.float32)
P2=np.array([(162,1337),(212,1475),(287,1600),(412,1675),(562,1712),(700,1750),(875,1825),(950,1875),(1000,1910)],np.float32)
bandR=np.zeros((SH,SW),np.uint8); cv2.polylines(bandR,[P1.astype(np.int32)],False,255,110); cv2.polylines(bandR,[P2.astype(np.int32)],False,255,40)
water=((b_>=r_-8)&(b_+g_>2*r_-30)).astype(np.uint8)*255
rm=cv2.bitwise_and(bandR,water)
rm=cv2.morphologyEx(rm,cv2.MORPH_OPEN,np.ones((3,3),np.uint8)); rm=cv2.morphologyEx(rm,cv2.MORPH_CLOSE,np.ones((9,9),np.uint8))
rmask=cv2.GaussianBlur(rm.astype(np.float32)/255,(0,0),2.0)
# flow field
pts=[];dirs=[]
for P in (P1,P2):
    for i in range(len(P)-1):
        a,b=P[i],P[i+1]; n_=int(np.linalg.norm(b-a)); dv=(b-a)/np.linalg.norm(b-a)
        for k in range(n_): pts.append(a+(b-a)*k/n_); dirs.append(dv)
pts=np.array(pts); dirs=np.array(dirs)
ry0,ry1=560,SH; rx0,rx1=0,1100
RY,RX=np.mgrid[ry0:ry1,rx0:rx1].astype(np.float32)
_,ri=cKDTree(pts).query(np.c_[RX.ravel(),RY.ravel()])
FX=dirs[ri,0].reshape(RX.shape).astype(np.float32); FY=dirs[ri,1].reshape(RX.shape).astype(np.float32)
FX=cv2.GaussianBlur(FX,(0,0),8); FY=cv2.GaussianBlur(FY,(0,0),8)
rippleTex=fbm(ry1-ry0,rx1-rx0,14,3,seed=31)
glintTex=fbm(ry1-ry0,rx1-rx0,5,2,seed=37)
rmk=rmask[ry0:ry1,rx0:rx1]

# ---------------- canvas statics ----------------
def to_canvas(a):
    out=np.zeros((CH,CW)+a.shape[2:],np.float32); out[TOP:]=a[:,X0:X1]; return out
skyA=np.ones((CH,CW),np.float32); skyA[TOP:]=skym[:,X0:X1]
groundA=1-skyA
cyy=np.arange(CH,dtype=np.float32)[:,None]; cxx=np.arange(CW,dtype=np.float32)[None,:]
HOR=TOP+470
t=np.clip(cyy/HOR,0,1)**1.25
zen=np.array([0.80,0.45,0.12],np.float32); mid=np.array([0.93,0.70,0.36],np.float32); hor=np.array([0.97,0.90,0.80],np.float32)
skyc=np.where((t<0.6)[...,None], zen+(mid-zen)*(t/0.6)[...,None], mid+(hor-mid)*((t-0.6)/0.4)[...,None])
skyc=np.broadcast_to(skyc,(CH,CW,3)).astype(np.float32).copy()
SUNX,SUNY=1190.,330.
rs=np.sqrt((cxx-SUNX)**2+(cyy-SUNY)**2)
ang=np.arctan2(cyy-SUNY,cxx-SUNX)
sunglow=(1.3*np.exp(-(rs/26)**2)+0.40*np.exp(-rs/120)+0.18*np.exp(-rs/480)).astype(np.float32)
rays=(0.5+0.5*np.cos(ang*18))*(0.5+0.5*np.cos(ang*7+1.3))
sunrays=(0.035*rays*np.exp(-rs/420)).astype(np.float32)
sunwarm=np.array([0.85,0.96,1.0],np.float32)
# clouds textures
CLW=CW+900
c1=fbm(1250,CLW,360,7,seed=41,pers=0.55)
c2=fbm(700,CLW,200,7,seed=43,pers=0.55)
csh=fbm(CH,CW+700,420,4,seed=47)
vig=(1-0.25*smooth(0.55,1.15,np.sqrt(((np.arange(OW)[None,:]-OW/2)/(OW/2))**2*0.8+((np.arange(OH)[:,None]-OH/2)/(OH/2))**2))).astype(np.float32)[...,None]

def clouds(tsec):
    # layer1 big cumulus, upper sky; layer2 small, lower near horizon
    o1=int(40+tsec*16); o2=int(10+tsec*7)
    d1=np.zeros((CH,CW),np.float32); d2=np.zeros((CH,CW),np.float32)
    d1[:1250]=c1[:,o1:o1+CW]; d2[620:1320]=c2[:,o2:o2+CW]
    prof1=smooth(1150,650,cyy)*(0.9+0.1*smooth(0,300,cyy))
    prof2=smooth(0,120,cyy-620)*smooth(700,520,cyy-620)
    clear=1-0.55*np.exp(-rs/230)
    a1=smooth(0.54,0.63,d1*prof1*clear)
    a2=smooth(0.56,0.64,d2*prof2)
    # lighting: compare density shifted toward sun (up-right)
    l1=np.roll(np.roll(d1,14,0),-10,1); l2=np.roll(np.roll(d2,8,0),-6,1)
    lit1=np.clip(0.66+(d1-l1)*14+0.2*(1-cyy/1300),0,1)
    lit2=np.clip(0.7+(d2-l2)*14,0,1)
    return a1,lit1,a2,lit2

def frame(fi):
    tsec=fi/FPS
    # ground (source coords) -> animate river + train
    G=g.copy()
    # river flow (two-phase flow map)
    T_=1.6; ph0=(tsec/T_)%1; ph1=(ph0+0.5)%1; A=16.0
    wgt=np.abs(ph0-0.5)*2
    base=g[ry0:ry1,rx0:rx1]
    def samp(ph,tex=None,img=None):
        mx_=RX-rx0-FX*A*ph; my_=RY-ry0-FY*A*ph
        return cv2.remap(img,mx_.astype(np.float32),my_.astype(np.float32),cv2.INTER_LINEAR,borderMode=cv2.BORDER_REFLECT)
    w0=samp(ph0,img=base); w1=samp(ph1,img=base)
    wat=w0*(1-wgt)[...,None] if False else w0*(1-wgt)+w1*wgt if False else None
    wat=w0*(1-wgt)+w1*wgt
    r0=samp(ph0*3%1,img=rippleTex); r1=samp((ph0*3+0.5)%1,img=rippleTex); wr=abs(((ph0*3)%1)-0.5)*2
    rip=r0*(1-wr)+r1*wr
    gl0=samp(ph0*2%1,img=glintTex); gl1=samp((ph0*2+0.5)%1,img=glintTex); wg=abs(((ph0*2)%1)-0.5)*2
    gl=gl0*(1-wg)+gl1*wg
    wat=wat*(0.88+0.3*(rip-0.5)[...,None])
    wat=wat+np.array([1,0.98,0.92],np.float32)*(smooth(0.80,0.86,gl)*0.12)[...,None]
    wat=np.clip(wat,0,1)
    G[ry0:ry1,rx0:rx1]=base*(1-rmk[...,None])+wat*rmk[...,None]
    # train
    off=SPEED*tsec
    sidx=np.arange(L,dtype=np.float32)
    mxs=np.broadcast_to(np.arange(2*D+1,dtype=np.float32)[None,:],(L,2*D+1)).astype(np.float32)
    mys=np.broadcast_to((sidx-off)[:,None],(L,2*D+1)).astype(np.float32)
    Tsh=cv2.remap(T,mxs,mys,cv2.INTER_LINEAR,borderMode=cv2.BORDER_CONSTANT,borderValue=0)
    Msh=cv2.remap(M,mxs,mys,cv2.INTER_LINEAR,borderMode=cv2.BORDER_CONSTANT,borderValue=0)
    # soft shadow of train on the down-left side
    Shd=np.roll(Msh,6,1); Shd=cv2.GaussianBlur(Shd,(0,0),2.5)
    Bs=B*(1-0.45*Shd*(1-Msh))[...,None]
    C=Bs*(1-Msh[...,None])+Tsh*Msh[...,None]
    Cimg=cv2.remap(C,band_mapx,band_mapy,cv2.INTER_LINEAR,borderMode=cv2.BORDER_REPLICATE)
    G[by0:by1,bx0:bx1]=G[by0:by1,bx0:bx1]*(1-bandA[...,None])+Cimg*bandA[...,None]
    canvas=to_canvas(G)
    # cloud shadows drifting over ground
    o=int(60+tsec*16)
    cs=smooth(0.56,0.70,csh[:,o:o+CW])
    canvas*= (1-0.30*cs*groundA)[...,None]
    # sky
    a1,lit1,a2,lit2=clouds(tsec)
    sky=skyc+(sunwarm*(sunglow+sunrays)[...,None])
    sunprox=np.exp(-rs/260)
    cl2=np.array([0.86,0.83,0.82],np.float32)+(np.array([1,1,1],np.float32)-np.array([0.86,0.83,0.82],np.float32))*lit2[...,None]
    sky=sky*(1-0.85*a2[...,None])+cl2*0.85*a2[...,None]
    sh=np.array([0.80,0.76,0.75],np.float32)
    cl1=sh+(np.array([1.0,1.0,1.0],np.float32)-sh)*lit1[...,None]
    cl1=cl1+ (sunwarm*(0.9*sunprox*(1-smooth(0.3,0.95,a1))))[...,None] if False else cl1+ sunwarm*(0.9*sunprox*(1-a1)*a1*4)[...,None]
    sky=sky*(1-a1[...,None])+cl1*a1[...,None]
    sky=sky+sunwarm*(0.55*np.exp(-(rs/40)**2)*(1-0.7*a1))[...,None]
    out=canvas*(1-skyA[...,None])+sky*skyA[...,None]
    # atmospheric haze near horizon + global sun bloom
    haze=smooth(HOR+380,HOR-60,cyy)*smooth(TOP-200,TOP+120,cyy)*0.18*groundA
    out=out*(1-haze[...,None])+np.array([0.95,0.88,0.80],np.float32)*haze[...,None]
    out=out+sunwarm*(0.10*np.exp(-rs/700))[...,None]
    # camera: slow push-in + slight drift toward train
    k=tsec/DUR; e=k*k*(3-2*k)
    z=1.0+0.11*e
    sc=OW/CW*z
    fx=CW/2+60*e; fy=CH*0.55+40*e
    Mx=np.array([[sc,0,OW/2-sc*fx],[0,sc,OH/2-sc*fy]],np.float32)
    # make sure we don't show outside
    Mx[0,2]=min(0,max(OW-sc*CW,Mx[0,2])); Mx[1,2]=min(0,max(OH-sc*CH,Mx[1,2]))
    fr=cv2.warpAffine(out,Mx,(OW,OH),flags=cv2.INTER_AREA if sc<1 else cv2.INTER_LINEAR)
    # grade
    fr=np.clip(fr,0,1.4); fr=np.where(fr>0.85,0.85+(fr-0.85)/(1+(fr-0.85)/0.15),fr)
    fr=(fr-0.5)*1.06+0.5
    fr=fr*vig
    lum=fr.mean(2,keepdims=True); fr=lum+(fr-lum)*1.0
    return (np.clip(fr,0,1)*255+0.5).astype(np.uint8)

if __name__=='__main__':
    mode=sys.argv[1]
    if mode=='test':
        for fi in [0,300,599]: cv2.imwrite(f'test_{fi}.jpg',frame(fi))
    else:
        a,b=int(sys.argv[2]),int(sys.argv[3])
        os.makedirs('frames',exist_ok=True)
        for fi in range(a,b): cv2.imwrite(f'frames/{fi:04d}.png',frame(fi))
