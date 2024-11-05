import express, { Request, Response } from 'express';
import { createClient } from '@supabase/supabase-js';
import morgan from 'morgan'
import bodyParser from "body-parser";
import dotenv from 'dotenv';
import multer from 'multer';
import { decode } from "base64-arraybuffer";


// import cors from '@types/cors';


dotenv.config();
// const app = express();
const app : express.Application = express();

app.use(morgan('combined'));
// app.use(cors());
app.use(bodyParser.urlencoded({extended: true}));
app.use(bodyParser.json());

const supabaseUrl: string = process.env.SUPABASE_PROJECT as string;
const supabaseKey: string = process.env.SUPABASE_API_KEY as string;

const supabase = createClient(supabaseUrl, supabaseKey);

const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 1000000 },    
  });

app.post('/upload', upload.single('gambar'), async (req: Request, res: Response) => {    
    if (!req.file) {
      res.status(400).send('No file uploaded');
      return;
    }
    
    const {
        id_uraian,
        nama_uraian,
        jenis_uraian,        
        nama_produk,
        keterangan,
        stok,
    } = req.body;

    const { data: existingUraian, error: existingUraianError } = await supabase.from('uraian').select('id_uraian').eq('nama_uraian', nama_uraian).eq('jenis_uraian', jenis_uraian);

    if (existingUraianError) {
      const statusCode = (existingUraianError as any).statusCode || 500;
      res.status(parseInt(statusCode)).send(existingUraianError);
      return;
    }
  
    if (existingUraian && existingUraian.length > 0) {
      res.status(400).json({ statusCode : 400, message : 'Nama dan Jenis Uraian sudah ada'});      
      return;
    }

    const uuid = require('uuid').v4;
    const file = req.file;
    const fileBase64 = decode(file.buffer.toString("base64"));
    const { data, error } = await supabase.storage
      .from('gordyn')
        .upload(file.originalname, fileBase64, {
        contentType: "image/png",
      });
      
    if (error) {
      const statusCode = (error as any).statusCode || 500;    
      res.status(parseInt(statusCode)).send(error);      
    }     
    else {
        // KainVitras
        // Accessories
        // KainStokanJadi
        // ModelGordyn
      const publicUrl = supabase.storage.from('gordyn').getPublicUrl(data.path);
      let randomId = uuid();      
      
      if (id_uraian != "" || id_uraian != null) {
        randomId = id_uraian;
      }
      else {
        const { data: uraianData, error: uraianError } = await supabase.from('uraian').insert({
          id_uraian: randomId,        
          nama_uraian : nama_uraian,
          jenis_uraian : jenis_uraian,
        });
        if (uraianError) {
          const statusCode = (uraianError as any).statusCode || 500;
          res.status(parseInt(statusCode)).send(uraianError);
        }
      }
      const { data: productData, error: produkError } = await supabase.from('produk').insert({
        id_produk : jenis_uraian.toString() + "-" + uuid(),
        id_uraian: randomId,
        nama_produk : nama_produk,
        keterangan : keterangan,
        stok : stok,
        url_gambar : publicUrl.data.publicUrl
      });
  
        if (produkError) {
            const statusCode = (produkError as any).statusCode || 500;
            res.status(parseInt(statusCode)).send(produkError);
            const { data: produkData, error: storageError } = await supabase.storage
            .from('gordyn')
            .remove([file.originalname]);
        }
        res.status(201).json({ statusCode : 201, message : 'File successfully created'});        
      
    //    res.status(201).json({ statusCode : 201, message : 'File successfully created', data : uraianData });
    //   res.send(`File uploaded successfully: ${publicUrl.data.publicUrl}`);
    }    
  });
  
  app.put('/uraian-produk/:id_uraian/:id_produk', upload.single('file'), async (req: Request, res: Response) => {
    const id_uraian = req.params.id_uraian;
    const id_produk = req.params.id_produk;
    const { nama_produk, keterangan, stok } = req.body;
    const file = req.file;
  
    const { error: produkError } = await supabase
      .from('produk')
      .update({
        nama_produk,
        keterangan,
        stok,
      })
      .eq('id_produk', id_produk);
  
    if (produkError) {
      const statusCode = (produkError as any).statusCode || 500;
      res.status(parseInt(statusCode)).send(produkError);
    }
  
    if (file) {
      const { data: produkData, error: produkDataError } = await supabase
        .from('produk')
        .select('url_gambar')
        .eq('id_produk', id_produk);
  
      if (produkDataError) {
        const statusCode = (produkDataError as any).statusCode || 500;
        res.status(parseInt(statusCode)).send(produkDataError);
      } else {
        const oldUrlGambar = produkData[0].url_gambar;
        
  
        const { error: storageError } = await supabase.storage
          .from('gordyn')
          .remove([oldUrlGambar]);
  
        if (storageError) {
          const statusCode = (storageError as any).statusCode || 500;
          res.status(parseInt(statusCode)).send(storageError);
        } else {
          const { error: uploadError } = await supabase.storage
            .from('gordyn')
            .upload(file.originalname, file.buffer, {
              contentType: "image/png",
            });
  
          if (uploadError) {
            const statusCode = (uploadError as any).statusCode || 500;
            res.status(parseInt(statusCode)).send(uploadError);
          } else {
            const newUrlGambar = `https://zuxxqfjrzscfofaymbsr.supabase.co/storage/v1/object/public/gordyn/${file.originalname}`;
  
            const { error: updateError } = await supabase
              .from('produk')
              .update({
                url_gambar: newUrlGambar,
              })
              .eq('id_produk', id_produk);
  
            if (updateError) {
              const statusCode = (updateError as any).statusCode || 500;
              res.status(parseInt(statusCode)).send(updateError);
            } else {
              res.status(200).json({ statusCode: 200, message: 'Data produk berhasil diupdate' });
            }
          }
        }
      }
    } else {
      res.status(200).json({ statusCode: 200, message: 'Data produk berhasil diupdate' });
    }
  });

  app.get('/uraian-produk', async (req: Request, res: Response) => {
    const page:any = req.query.page || 1;
    const limit:any = req.query.limit || 10;

    const offset = (page - 1) * limit;
    const { data: uraianData, error: uraianError } = await supabase
      .from('uraian')
      .select('id_uraian, nama_uraian, jenis_uraian,created_at')
      .range(offset, offset + limit);
  
    const { data: produkData, error: produkError } = await supabase
      .from('produk')
      .select('id_produk, nama_produk, keterangan, stok, url_gambar, id_uraian')
      .range(offset, offset + limit);
  
    if (uraianError || produkError) {
        if (uraianError) {
            const statusCode = (uraianError as any).statusCode || 500;
            res.status(parseInt(statusCode)).send(uraianError);
        }
        if (produkError) {
            const statusCode = (produkError as any).statusCode || 500;
            res.status(parseInt(statusCode)).send(produkError);
        }
        res.status(500).json({ statusCode: 500, message: 'Error server' });
    } else {
      const combinedData = uraianData.map((uraian) => {
        const produk = produkData.filter((produk) => produk.id_uraian === uraian.id_uraian);
        return { ...uraian, produk:produk };
      });
      const { data: totalCountData, error: totalCountError } = await supabase
      .from('uraian')
      .select('*', { count: 'exact' });
    
    if (totalCountError) {
      const statusCode = (totalCountError as any).statusCode || 500;
      res.status(parseInt(statusCode)).send(totalCountError);
    } else {
      const totalCount = totalCountData[0].count;
      const totalPages = Math.ceil(totalCount / limit);
    
      res.status(200).json({
        statusCode: 200,
        message: 'Data uraian dan produk berhasil diambil',
        data: combinedData,
        pagination: {
          page,
          limit,
          totalPages,
          totalCount,
        },
      });
    }
    //   res.status(200).json({ statusCode: 200, message: 'Data uraian dan produk berhasil diambil', data: combinedData });
    }
  });  

  app.delete('/uraian-produk/:id_uraian/:id_produk', async (req: Request, res: Response) => {
    const id_uraian = req.params.id_uraian;
    const id_produk = req.params.id_produk;
  
    // Hapus data produk dari table produk
    const { error: produkError } = await supabase
      .from('produk')
      .delete()
      .eq('id_produk', id_produk);
  
    if (produkError) {
      const statusCode = (produkError as any).statusCode || 500;
      res.status(parseInt(statusCode)).send(produkError);
    } else {
      // Hapus gambar dari storage
      const { data: produkData, error: produkDataError } = await supabase
        .from('produk')
        .select('url_gambar')
        .eq('id_produk', id_produk);
  
      if (produkDataError) {
        const statusCode = (produkDataError as any).statusCode || 500;
        res.status(parseInt(statusCode)).send(produkDataError);
      } else if (produkData && produkData.length > 0) {
        const urlGambar = produkData[0].url_gambar;
        const { error: storageError } = await supabase.storage
          .from('gordyn')
          .remove([urlGambar]);
  
        if (storageError) {
          const statusCode = (storageError as any).statusCode || 500;
          res.status(parseInt(statusCode)).send(storageError);
        } else {
          res.status(200).json({ statusCode: 200, message: 'Data produk berhasil dihapus' });
        }
      } else {
        res.status(200).json({ statusCode: 200, message: 'Data produk berhasil dihapus' });
      }
    }
  });

  app.delete('/uraian-produk/:nameimage', async (req: Request, res: Response) => {
    try {
      const nameimage = req.params.nameimage;
      const pathGambar = 'top-secret-stamp-top-secret-grunge-square-sign_822766-11246-removebg-preview.png';
      const { data: produkData, error: storageError } = await supabase.storage
        .from('gordyn')
        .remove([nameimage]);
  
      if (storageError || (produkData && produkData.length === 0)) {       
        res.status(500).json({ statusCode: 500, message: 'Error menghapus gambar' });
      } else {
        res.status(200).json({ statusCode: 200, message: 'Data produk aaa dihapus', data: produkData });
      }
    } catch (error:any) {
      res.status(500).json({ statusCode: 500, message: error.message });
    }
  });
  



// app.get('/products', async (req: Request, res: Response) => {
//     const {data, error} = await supabase
//         .from('products')
//         .select()
//     res.send(data);
// });

// app.get('/products/:id', async (req: Request, res: Response) => {
//     const {data, error} = await supabase
//         .from('products')
//         .select()
//         .eq('id', req.params.id)
//     res.send(data);
// });

// app.post('/products', async (req: Request, res: Response) => {
//     const {error} = await supabase
//         .from('products')
//         .insert({
//             name: req.body.name,
//             description: req.body.description,
//             price: req.body.price,
//         })
//     if (error) {
//         res.send(error);
//     }
//     res.send("created!!");
// });

// app.put('/products/:id', async (req: Request, res: Response) => {
//     const {error} = await supabase
//         .from('products')
//         .update({
//             name: req.body.name,
//             description: req.body.description,
//             price: req.body.price
//         })  
//         .eq('id', req.params.id)
//     if (error) {
//         res.send(error);
//     }
//     res.send("updated!!");
// });

// app.delete('/products/:id', async (req:Request, res:Response) => {
//     const {error} = await supabase
//         .from('products')
//         .delete()
//         .eq('id', req.params.id)
//     if (error) {
//         res.send(error);
//     }
//     res.send("deleted!!")

// });

app.get('/', (req:Request, res:Response) => {
    res.send("Hello I am working my friend Supabase <3");
});

app.get('*', (req:Request, res:Response) => {
    res.send("Hello again I am working my friend to the moon and behind <3");
});

app.listen(3000, () => {
    console.log(`> Ready on http://localhost:3000`);
});