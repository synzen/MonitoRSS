import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';

dayjs.extend(utc);

// New migrations are hand-written entries appended to the MIGRATIONS list in
// src/stores/postgres/migrations.ts. This prints a ready-to-paste entry with
// the next 14-digit UTC timestamp version.
const version = dayjs().utc().format('YYYYMMDDHHmmss');

const template = `  {
    version: '${version}',
    name: 'Migration${version}',
    async up(client) {
      await client.query('<up sql>');
    },
    async down(client) {
      await client.query('<down sql>');
    },
  },`;

// eslint-disable-next-line no-console -- the printed template is the deliverable
console.log(template);
