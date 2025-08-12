INSERT INTO public.mcqs (topic, difficulty, question_text, choices, correct_choice)
VALUES
('algebra','easy',
 'Solve: 2x + 3 = 11. What is x?',
 '{
   \"A\":{\"text\":\"3\",\"weakness_tag\":\"linear_isolation\"},
   \"B\":{\"text\":\"4\",\"weakness_tag\":\"none\"},
   \"C\":{\"text\":\"5\",\"weakness_tag\":\"addition_error\"},
   \"D\":{\"text\":\"8\",\"weakness_tag\":\"coefficient_misread\"}
 }','B'),
('algebra','medium',
 'Simplify: (x^2 - 9)/(x - 3)',
 '{
   \"A\":{\"text\":\"x + 3\",\"weakness_tag\":\"factor_cancel\"},
   \"B\":{\"text\":\"x - 3\",\"weakness_tag\":\"sign_error\"},
   \"C\":{\"text\":\"x^2 - 3\",\"weakness_tag\":\"incomplete_factor\"},
   \"D\":{\"text\":\"x + 9\",\"weakness_tag\":\"incorrect_factor\"}
 }','A'),
('trig','easy',
 'What is sin(30Â°)?',
 '{
   \"A\":{\"text\":\"1/2\",\"weakness_tag\":\"none\"},
   \"B\":{\"text\":\"âˆš3/2\",\"weakness_tag\":\"swap_values\"},
   \"C\":{\"text\":\"1\",\"weakness_tag\":\"unit_circle_confuse\"},
   \"D\":{\"text\":\"0\",\"weakness_tag\":\"axis_confuse\"}
 }','A'),
('geometry','hard',
 'Area of a circle with circumference 8Ï€?',
 '{
   \"A\":{\"text\":\"16Ï€\",\"weakness_tag\":\"misapply_formula\"},
   \"B\":{\"text\":\"4Ï€\",\"weakness_tag\":\"radius_square_error\"},
   \"C\":{\"text\":\"8Ï€\",\"weakness_tag\":\"circumference_confuse\"},
   \"D\":{\"text\":\"64Ï€\",\"weakness_tag\":\"square_circumference_misuse\"}
 }','A');
