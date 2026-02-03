-- 1. 검색 성능 향상을 위한 확장 기능 설치 (필수)
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- 2. 텍스트 검색(ilike) 가속을 위한 GIN 인덱스 (이름, 주소, 카테고리)
CREATE INDEX IF NOT EXISTS idx_places_v2_name_trgm ON places_v2 USING GIN (place_name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_places_v2_addr_trgm ON places_v2 USING GIN (address_road gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_places_v2_food_trgm ON places_v2 USING GIN (food_category gin_trgm_ops);

-- 3. 태그(배열) 검색 가속
CREATE INDEX IF NOT EXISTS idx_places_v2_tags ON places_v2 USING GIN (tags);

-- 4. 정렬 및 기본 필터 가속
CREATE INDEX IF NOT EXISTS idx_places_v2_manage_no ON places_v2 (manage_no DESC);
CREATE INDEX IF NOT EXISTS idx_places_v2_region_sido ON places_v2 (region_sido);
CREATE INDEX IF NOT EXISTS idx_places_v2_region_sigungu ON places_v2 (region_sigungu);
