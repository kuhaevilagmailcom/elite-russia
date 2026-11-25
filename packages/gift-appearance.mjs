// Official Telegram UniqueGiftBackdropColors and UniqueGiftSymbol.
const rgb=v=>Number.isInteger(v)&&v>=0&&v<=0xffffff?v:null;
const id=v=>typeof v==="string"&&/^[A-Za-z0-9_-]{5,512}$/.test(v)?v:null;
export function giftAppearance(g){
 const c=g.backdrop?.colors||{},s=g.symbol?.sticker;
 const colors={center:rgb(c.center_color),edge:rgb(c.edge_color),symbol:rgb(c.symbol_color),text:rgb(c.text_color)};
 // Animated symbol thumbnails are static PNG/WebP, suitable for the alpha mask.
 const file=id(s?.thumbnail?.file_id)||(!s?.is_animated&&!s?.is_video?id(s?.file_id):null);
 return {backdropColors:colors,symbolMediaUrl:file?"/api/v1/media/telegram/"+encodeURIComponent(file):null};
}
