--
-- PostgreSQL database dump
--

\restrict HVqTBSa790oaTSbE275TRgaQe0pueuQx4itMmuazoKiQaiCaWsTamknDk2oga1Q

-- Dumped from database version 18.1
-- Dumped by pg_dump version 18.1 (Homebrew)

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: cafeterias; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.cafeterias (
    id integer NOT NULL,
    name character varying(255) NOT NULL,
    location character varying(255),
    "isOpen" boolean DEFAULT true NOT NULL,
    "staticQrToken" character varying(255) NOT NULL,
    "createdAt" timestamp with time zone NOT NULL,
    "updatedAt" timestamp with time zone NOT NULL
);


ALTER TABLE public.cafeterias OWNER TO postgres;

--
-- Name: cafeterias_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.cafeterias_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.cafeterias_id_seq OWNER TO postgres;

--
-- Name: cafeterias_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.cafeterias_id_seq OWNED BY public.cafeterias.id;


--
-- Name: cafeterias id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.cafeterias ALTER COLUMN id SET DEFAULT nextval('public.cafeterias_id_seq'::regclass);


--
-- Data for Name: cafeterias; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.cafeterias (id, name, location, "isOpen", "staticQrToken", "createdAt", "updatedAt") FROM stdin;
1	ANANTHA AAHARA	Main Block	t	STATIC_QR_CAFETERIA_1	2025-12-19 23:23:54.746+05:30	2025-12-19 23:23:54.746+05:30
2	AROMOS	Block A	t	AROMAS_QR_123	2025-12-19 23:23:54.746+05:30	2025-12-19 23:23:54.746+05:30
3	DHANAPANI	Block B	t	NESTLE_QR_789	2025-12-19 23:23:54.746+05:30	2025-12-19 23:23:54.746+05:30
4	FOODCLUB	Block C	t	FOODCOURT_QR_456	2025-12-19 23:23:54.746+05:30	2025-12-19 23:23:54.746+05:30
\.


--
-- Name: cafeterias_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.cafeterias_id_seq', 4, true);


--
-- Name: cafeterias cafeterias_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.cafeterias
    ADD CONSTRAINT cafeterias_pkey PRIMARY KEY (id);


--
-- PostgreSQL database dump complete
--

\unrestrict HVqTBSa790oaTSbE275TRgaQe0pueuQx4itMmuazoKiQaiCaWsTamknDk2oga1Q

