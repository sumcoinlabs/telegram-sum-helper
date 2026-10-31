// Editorial tool for transcripts supplied by the project owner; never execute transcripts.
import fs from 'node:fs';
import path from 'node:path';
export function podcastParts(raw,{label,slug,source='user-supplied-transcript',cautions=[]}={}){
 if(!/^[a-z0-9-]+$/.test(slug||''))throw Error('Invalid slug');
 const lines=String(raw).split(/\r?\n/),docs=[];let current=null;
 for(const line of lines){const heading=line.match(/^Chapter\s+\d+:\s*(.+)$/i);
  if(heading){if(current)docs.push(current);current={id:`${slug}-${docs.length+1}`,title:`${label} — ${heading[1].trim()} (historical / unreviewed)`,text:'',source,reviewed:false,provenance:'user-supplied-transcript'};continue;}
  if(!current||!line.trim())continue;
  const speech=line.replace(/^\s*\d{1,3}:\d{2}.*?seconds/iu,' ').replace(/^\s*\d+:\d{2}.*?(?:minute|minutes|seconds)/iu,' ').replace(/\s+/g,' ').trim();
  current.text+=' '+speech;
 }
 if(current)docs.push(current);
 const safe=docs.filter(d=>d.text.trim().length>40).map(d=>({...d,text:d.text.replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').trim().slice(0,18000)}));
 return {schemaVersion:1,source,reviewed:false,provenance:'user-supplied-transcript',cautions,documents:safe};
}
if(process.argv[1]?.endsWith('prepare-podcast.mjs')&&process.argv.length>2){
 const [input,out,slug,label]=process.argv.slice(2);const result=podcastParts(fs.readFileSync(input,'utf8'),{slug,label});fs.writeFileSync(out,JSON.stringify(result,null,2)+'\n');console.log(result.documents.length);
}
