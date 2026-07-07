
-- Ensure department names are unique so we can safely upsert
CREATE UNIQUE INDEX IF NOT EXISTS departments_name_key ON public.departments (name);

-- Add missing faculties
INSERT INTO public.faculties (name, icon)
SELECT v.name, v.icon FROM (VALUES
  ('Faculty of Engineering', '⚙️'),
  ('Faculty of Environmental Sciences', '🏛️'),
  ('Faculty of Arts', '🎭')
) AS v(name, icon)
WHERE NOT EXISTS (SELECT 1 FROM public.faculties f WHERE f.name = v.name);

-- Insert missing departments, mapped to their faculty
WITH mapping(dept_name, faculty_name) AS (
  VALUES
    ('Accountancy', 'Faculty of Management Sciences'),
    ('Banking and Finance', 'Faculty of Management Sciences'),
    ('Business Management', 'Faculty of Management Sciences'),
    ('Marketing', 'Faculty of Management Sciences'),
    ('Public Administration', 'Faculty of Management Sciences'),
    ('Entrepreneurship', 'Faculty of Management Sciences'),

    ('Accountancy Education', 'Faculty of Education'),
    ('Admin and Planning', 'Faculty of Education'),
    ('Agric Education', 'Faculty of Education'),
    ('Business Education', 'Faculty of Education'),
    ('Building Technology Education', 'Faculty of Education'),
    ('Education Biology', 'Faculty of Education'),
    ('Education Chemistry', 'Faculty of Education'),
    ('Education Computer Science', 'Faculty of Education'),
    ('Education Economics', 'Faculty of Education'),
    ('Education English Language', 'Faculty of Education'),
    ('Education Igbo', 'Faculty of Education'),
    ('Education Integrated Science', 'Faculty of Education'),
    ('Education Mathematics', 'Faculty of Education'),
    ('Education Physics', 'Faculty of Education'),
    ('Education Religious Studies', 'Faculty of Education'),
    ('Education Social Studies', 'Faculty of Education'),
    ('Electrical Electronics Technology Education', 'Faculty of Education'),
    ('Guidance and Counselling', 'Faculty of Education'),
    ('Health Education', 'Faculty of Education'),
    ('Home Economics', 'Faculty of Education'),
    ('Human Kinetics', 'Faculty of Education'),
    ('Mechanical / Automobile Technology Education', 'Faculty of Education'),
    ('Mechanical Metalwork Technology Education', 'Faculty of Education'),
    ('Secretarial Studies Education', 'Faculty of Education'),
    ('Special Education', 'Faculty of Education'),
    ('Woodwork Education', 'Faculty of Education'),

    ('Agric Economics, Management and Extension', 'Faculty of Agricultural and Natural Resource Management'),
    ('Animal Science', 'Faculty of Agricultural and Natural Resource Management'),
    ('Crop Science and Landscape Management', 'Faculty of Agricultural and Natural Resource Management'),
    ('Fisheries and Aquaculture', 'Faculty of Agricultural and Natural Resource Management'),
    ('Food Science and Technology', 'Faculty of Agricultural and Natural Resource Management'),
    ('Soil and Environmental Management', 'Faculty of Agricultural and Natural Resource Management'),

    ('Applied Biology', 'Faculty of Science'),
    ('Applied Microbiology', 'Faculty of Science'),
    ('Applied Statistics', 'Faculty of Science'),
    ('Biochemistry', 'Faculty of Science'),
    ('Biotechnology', 'Faculty of Science'),
    ('Computer Science', 'Faculty of Science'),
    ('Geology and Exploration Geophysics', 'Faculty of Science'),
    ('Industrial Chemistry', 'Faculty of Science'),
    ('Industrial Mathematics', 'Faculty of Science'),
    ('Industrial Physics', 'Faculty of Science'),

    ('Anatomy', 'Faculty of Basic Medical Sciences'),
    ('Physiology', 'Faculty of Basic Medical Sciences'),
    ('Medicine and Surgery', 'Faculty of Clinical Medicine'),

    ('Medical Laboratory Science', 'Faculty of Health Sciences and Technology'),
    ('Nursing Science', 'Faculty of Health Sciences and Technology'),

    ('Chemical Engineering', 'Faculty of Engineering'),
    ('Civil Engineering', 'Faculty of Engineering'),
    ('Electrical and Electronics Engineering', 'Faculty of Engineering'),

    ('Architecture', 'Faculty of Environmental Sciences'),
    ('Building', 'Faculty of Environmental Sciences'),
    ('Estate Management', 'Faculty of Environmental Sciences'),
    ('Environmental Management', 'Faculty of Environmental Sciences'),

    ('Economics', 'Faculty of Social Sciences and Humanities'),
    ('English Language & Literature', 'Faculty of Social Sciences and Humanities'),
    ('French', 'Faculty of Social Sciences and Humanities'),
    ('History and International Relations', 'Faculty of Social Sciences and Humanities'),
    ('Igbo', 'Faculty of Social Sciences and Humanities'),
    ('Library & Information Science', 'Faculty of Social Sciences and Humanities'),
    ('Linguistics', 'Faculty of Social Sciences and Humanities'),
    ('Mass Communication', 'Faculty of Social Sciences and Humanities'),
    ('Philosophy', 'Faculty of Social Sciences and Humanities'),
    ('Political Science', 'Faculty of Social Sciences and Humanities'),
    ('Psychology', 'Faculty of Social Sciences and Humanities'),
    ('Religion and Peace Studies', 'Faculty of Social Sciences and Humanities'),
    ('Social Work', 'Faculty of Social Sciences and Humanities'),
    ('Sociology & Anthropology', 'Faculty of Social Sciences and Humanities'),

    ('Film Production', 'Faculty of Arts'),
    ('Theatre Art', 'Faculty of Arts'),

    ('Law', 'Faculty of Law')
)
INSERT INTO public.departments (name, faculty_id)
SELECT m.dept_name, f.id
FROM mapping m
JOIN public.faculties f ON f.name = m.faculty_name
ON CONFLICT (name) DO UPDATE SET faculty_id = EXCLUDED.faculty_id;
