CREATE TABLE spiele (
   id SERIAL PRIMARY KEY,
anstoss TIMESTAMP WITH TIME ZONE NOT NULL,
   heimverein TEXT NOT NULL,
   gastverein TEXT NOT NULL,
   heimtore INTEGER ,
   gasttore INTEGER ,
   statuswort TEXT NOT NULL
);

