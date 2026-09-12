export interface Theme {
  id: string;
  title: string;
  description?: string;
  primary: string;
  secondary: string;
  bg_image:{
    url:string,
    fileId?:string
  };
  planet_image:{
    url:string;
    fileId:string;
  };
}
