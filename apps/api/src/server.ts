import { app } from './app';
import { env } from './env';

app.listen(env.PORT, () => console.log(`API → http://localhost:${env.PORT}`));
