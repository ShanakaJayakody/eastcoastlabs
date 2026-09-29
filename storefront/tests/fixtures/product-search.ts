import type { CardProduct } from '@/components/ProductCard';

const prices = {price:'6500',regular_price:'6500',sale_price:'',currency_code:'AUD',currency_minor_unit:2,currency_prefix:'$',currency_suffix:''};
export const searchProducts: CardProduct[] = [
  {id:1,name:'BPC-157 blend',slug:'bpc-157-blend',sku:'BLEND',prices,images:[],is_in_stock:true},
  {id:2,name:'BPC-157',slug:'bpc-157',sku:'BPC-10',prices,images:[{src:'/images/rebrand/vials/v2/bpc-157.webp',alt:'BPC-157 vial'}],is_in_stock:true,sizes:[
    {id:2,slug:'bpc-157',sku:'BPC-10',label:'10',priceMinor:'6500',available:8,tiers:null},
    {id:3,slug:'bpc-157-small',sku:'BPC-5',label:'5 mg',priceMinor:'4500',available:0,tiers:null},
    {id:4,slug:'bpc-157-large',sku:'BPC-15',label:'15 mg',priceMinor:'8500',available:3,tiers:null},
  ]},
  {id:5,name:'GHK-Cu',slug:'ghk-cu',sku:'GHK-50',prices,images:[],is_in_stock:true,sizes:[
    {id:5,slug:'ghk-cu',sku:'GHK-50',label:'50 mg',priceMinor:'5500',available:2,tiers:null},
  ]},
  {id:6,name:'KLOW',slug:'klow',sku:'KLOW-80',prices,images:[],is_in_stock:true},
  {id:7,name:'Tesamorelin',slug:'tesamorelin',sku:'TESA-10',prices,images:[],is_in_stock:false},
  {id:8,name:'Retatrutide',slug:'retatrutide',sku:'RETA-10',prices,images:[],is_in_stock:true},
];
