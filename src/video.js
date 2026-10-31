// Manual transcript import: searchable as attributed, unreviewed evidence only.
// A transcript is NEVER promoted to an automatic factual answer without admin review.
import fs from 'node:fs';
import path from 'node:path';
const VIDEO_ID='_dq55ykFDHs';
const file=new URL('../data/video-transcripts.json',import.meta.url);
export const APPROVED_VIDEO=`https://www.youtube.com/watch?v=${VIDEO_ID}`;
export function importTranscript(input,{out=file,id=VIDEO_ID}={}){
  if(id!==VIDEO_ID)throw Error('Video has not been approved for transcript intake.');
  const raw=String(input||'');
  if(raw.length<200||raw.length>160_000)throw Error('Transcript must contain 200–160000 characters.');
  if(/<\?(?:php)?|<script\b|\b(?:private key|seed phrase)\s*[:=]\s*[a-z]+/i.test(raw))throw Error('Potentially unsafe transcript content.');
  const text=raw.replace(/^\s*(?:WEBVTT\s*|\d+\s*$|\d\d:\d\d:\d\d[.,]\d+\s+-->.*$)/gim,' ').replace(/<[^>]*>/g,' ').replace(/\s+/g,' ').trim();
  const words=text.split(/\s+/);const docs=[];
  for(let i=0;i<words.length&&docs.length<90;i+=150)docs.push({id:`video-${id}-${docs.length}`,title:`Video transcript ${id} segment ${docs.length+1} (unreviewed)`,text:words.slice(i,i+150).join(' '),source:APPROVED_VIDEO,reviewed:false});
  const target=out instanceof URL?out:path.resolve(out);fs.mkdirSync(path.dirname(target),{recursive:true,mode:0o700});
  const temp=String(target)+'.'+process.pid+'.new';fs.writeFileSync(temp,JSON.stringify({generatedAt:new Date().toISOString(),videoId:id,documents:docs},null,2)+'\n',{mode:0o600});fs.renameSync(temp,target);
  return docs.length;
}
