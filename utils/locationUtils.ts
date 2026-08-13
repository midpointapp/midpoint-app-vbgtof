import { SessionParticipant } from '@/types';
import { DEFAULT_SEARCH_RADIUS } from '@/constants/config';
import { supabase } from '@/app/integrations/supabase/client';

export interface Coordinates { latitude:number; longitude:number; }
export interface Place { id:string; name:string; address:string; latitude:number; longitude:number; rating:number; distance:number; placeId?:string; }
export function maskCoordinates(lat:number,lng:number){return{lat:Math.round(lat*100)/100,lng:Math.round(lng*100)/100};}
export function calculateMidpoint(userLat:number,userLng:number,contactLat:number,contactLng:number,safeMeet=false){const u=safeMeet?maskCoordinates(userLat,userLng):{lat:userLat,lng:userLng};return{midLat:(u.lat+contactLat)/2,midLng:(u.lng+contactLng)/2};}
export function calculateMidpointFromParticipants(participants:SessionParticipant[]):Coordinates|null{const v=participants.filter(p=>p.user_lat!==undefined&&p.user_lng!==undefined);if(!v.length)return null;return{latitude:v.reduce((a,p)=>a+(p.user_lat||0),0)/v.length,longitude:v.reduce((a,p)=>a+(p.user_lng||0),0)/v.length};}
export function calculateDistance(lat1:number,lon1:number,lat2:number,lon2:number){const R=6371,r=(a:number)=>a*Math.PI/180,dLat=r(lat2-lat1),dLon=r(lon2-lon1);const a=Math.sin(dLat/2)**2+Math.cos(r(lat1))*Math.cos(r(lat2))*Math.sin(dLon/2)**2;return R*2*Math.atan2(Math.sqrt(a),Math.sqrt(1-a));}
export function calculateDynamicRadius(lat1:number,lng1:number,lat2:number,lng2:number){return Math.round(Math.min(Math.max(calculateDistance(lat1,lng1,lat2,lng2)*.15,5),50)*1000);}
export function getGooglePlacesType(t:string):{type?:string;keyword?:string}{switch(t){case'coffee':case'cafe':return{type:'cafe'};case'food':case'restaurant':return{type:'restaurant'};case'marketplace':case'shopping_mall':return{type:'shopping_mall'};case'gas':case'gas_station':return{type:'gas_station'};case'park':return{type:'park'};case'police':return{type:'police'};case'rest':return{keyword:'rest area'};default:return{type:'point_of_interest'};}}
export async function searchNearbyPlaces(midLat:number,midLng:number,meetupType:string,radiusMeters?:number):Promise<Place[]>{
 if(!Number.isFinite(midLat)||!Number.isFinite(midLng)||midLat< -90||midLat>90||midLng< -180||midLng>180)return[];
 const {type,keyword}=getGooglePlacesType(meetupType); const radius=radiusMeters??DEFAULT_SEARCH_RADIUS;
 const {data,error}=await supabase.functions.invoke('places-proxy',{body:{lat:midLat,lng:midLng,type,keyword,radius}}); if(error)throw new Error(error.message||'Places search failed');
 if(data?.status==='ZERO_RESULTS')return[]; if(data?.status!=='OK'||!Array.isArray(data?.results))throw new Error(data?.error_message||'Places search failed');
 return data.results.map((p:any,i:number)=>({id:p.place_id||`place-${i}`,name:p.name,address:p.vicinity||p.formatted_address||'Address not available',latitude:p.geometry.location.lat,longitude:p.geometry.location.lng,rating:p.rating||0,distance:calculateDistance(midLat,midLng,p.geometry.location.lat,p.geometry.location.lng),placeId:p.place_id})).sort((a:Place,b:Place)=>b.rating-a.rating||a.distance-b.distance).slice(0,5);
}
export function openMapsApp(latitude:number,longitude:number,label?:string){return label?`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(label)}&query_place_id=${latitude},${longitude}`:`https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`;}
