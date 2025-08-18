/**
 * Initial Lessons Data
 * Date: 2025-08-18 11:35:00 UTC
 * Author: sophoniagoat
 *
 * Core content library for mathematics lessons
 */

export const INITIAL_LESSONS = [
  // ALGEBRA LESSONS
  {
    title: 'Linear Equations Fundamentals',
    content: `# Understanding Linear Equations

Linear equations are the foundation of algebra. They follow the form:

ax + b = c

Where a, b, and c are constants, and x is the variable we're solving for.

## Key Concepts:

- Isolate the variable by performing the same operation on both sides
- Combine like terms to simplify
- Check your answer by substituting back

Example:
Solve 3x + 5 = 20

Step 1: Subtract 5 from both sides
3x = 15

Step 2: Divide both sides by 3
x = 5

Step 3: Check: 3(5) + 5 = 15 + 5 = 20 ✓

Note: Remember to keep the equation balanced - whatever you do to one side, you must do to the other side.`,
    topic: 'algebra',
    subject: 'math',
    grade_level: 10
  },
  {
    title: 'Solving Quadratic Equations',
    content: `# Quadratic Equations

Quadratic equations are in the form:

ax² + bx + c = 0

Where a, b, and c are constants (a ≠ 0), and x is the variable.

## Three Methods for Solving:

1. Factoring (when possible)
2. Completing the square
3. Quadratic formula

## The Quadratic Formula:
x = (-b ± √(b² - 4ac)) / 2a

Example:
Solve x² - 5x + 6 = 0

Method 1: Factoring
x² - 5x + 6 = 0
(x - 2)(x - 3) = 0
x = 2 or x = 3

Method 2: Quadratic Formula
a = 1, b = -5, c = 6
x = (5 ± √(25 - 24)) / 2
x = (5 ± √1) / 2
x = (5 ± 1) / 2
x = 3 or x = 2

Note: The discriminant (b² - 4ac) tells you how many solutions exist:
- If positive: two real solutions
- If zero: one real solution
- If negative: two complex solutions`,
    topic: 'algebra',
    subject: 'math',
    grade_level: 10
  },
  {
    title: 'Systems of Linear Equations',
    content: `# Systems of Linear Equations

A system of linear equations has multiple equations with multiple variables. We're looking for values that satisfy all equations simultaneously.

## Solving Methods:

1. Substitution
2. Elimination
3. Graphing (intersection point)

## Substitution Method:
1. Solve one equation for one variable
2. Substitute into the other equation
3. Solve for the remaining variable
4. Substitute back to find all values

Example:
Solve: 
y = 2x + 1
3x - y = 5

Step 1: Substitute y = 2x + 1 into second equation
3x - (2x + 1) = 5

Step 2: Solve for x
3x - 2x - 1 = 5
x - 1 = 5
x = 6

Step 3: Find y by substituting back
y = 2(6) + 1
y = 12 + 1
y = 13

Solution: (6, 13)

Note: Systems can have:
- One unique solution (lines intersect)
- No solution (parallel lines)
- Infinite solutions (same line)`,
    topic: 'algebra',
    subject: 'math',
    grade_level: 10
  },

  // CALCULUS LESSONS
  {
    title: 'Introduction to Derivatives',
    content: `# Derivatives: The Concept of Rate of Change

A derivative measures how quickly a function changes. It's the instantaneous rate of change at a point.

## The Formal Definition:
f'(x) = lim(h→0) [f(x+h) - f(x)]/h

## Intuitive Understanding:
- For a position function, the derivative gives velocity
- For a velocity function, the derivative gives acceleration
- The derivative is the slope of the tangent line at a point

## Basic Derivative Rules:
1. Power Rule: d/dx(xⁿ) = n·xⁿ⁻¹
2. Constant Rule: d/dx(c) = 0
3. Constant Multiple Rule: d/dx(c·f(x)) = c·f'(x)
4. Sum Rule: d/dx(f(x) + g(x)) = f'(x) + g'(x)

Example:
Find the derivative of f(x) = 3x² + 2x - 5

Using the rules:
f'(x) = 3·2x¹ + 2·1x⁰ - 0
f'(x) = 6x + 2

Note: Derivatives tell us where functions increase, decrease, and have maximum/minimum points. They're essential for optimization problems.`,
    topic: 'calculus',
    subject: 'math',
    grade_level: 11
  },
  {
    title: 'Differentiation Rules',
    content: `# Essential Differentiation Rules

Knowing these rules allows you to find derivatives quickly without using the limit definition.

## Core Rules:
1. Power Rule: d/dx(xⁿ) = n·xⁿ⁻¹
2. Constant Rule: d/dx(c) = 0
3. Sum/Difference Rule: d/dx(f ± g) = f' ± g'
4. Product Rule: d/dx(f·g) = f'·g + f·g'
5. Quotient Rule: d/dx(f/g) = (f'·g - f·g')/g²
6. Chain Rule: d/dx(f(g(x))) = f'(g(x))·g'(x)

## Derivatives of Common Functions:
- d/dx(sin x) = cos x
- d/dx(cos x) = -sin x
- d/dx(eˣ) = eˣ
- d/dx(ln x) = 1/x

Example:
Find d/dx(x²·sin x)

Using the Product Rule:
d/dx(x²·sin x) = d/dx(x²)·sin x + x²·d/dx(sin x)
d/dx(x²·sin x) = 2x·sin x + x²·cos x

Note: The Chain Rule is especially important for composite functions. Remember to work from the outside in.`,
    topic: 'calculus',
    subject: 'math',
    grade_level: 11
  },
  {
    title: 'Applications of Derivatives',
    content: `# Practical Applications of Derivatives

Derivatives have many real-world applications beyond finding slopes.

## Key Applications:

1. Finding Rates of Change
   - How quickly populations grow
   - How fast objects accelerate
   - How heat dissipates

2. Optimization Problems
   - Maximum profits
   - Minimum costs
   - Optimal dimensions

3. Curve Sketching
   - Increasing/decreasing intervals (f' > 0 or f' < 0)
   - Local maxima/minima (f' = 0 and f'' ≠ 0)
   - Concavity (f'' > 0 or f'' < 0)

Example:
A box with square base and no top needs to have volume 16 m³. Find the dimensions that minimize the amount of material used.

Step 1: Let x = side length of base, h = height
Volume = x²h = 16, so h = 16/x²

Step 2: Material used = x² (base) + 4xh (sides)
       = x² + 4x·(16/x²)
       = x² + 64/x

Step 3: Find derivative and set equal to zero
A'(x) = 2x - 64/x²
2x - 64/x² = 0
2x = 64/x²
2x³ = 64
x³ = 32
x = 2∛4 ≈ 3.17

Step 4: Calculate h = 16/x² ≈ 1.59

Dimensions: 3.17m × 3.17m × 1.59m

Note: The second derivative test can confirm this is a minimum.`,
    topic: 'calculus',
    subject: 'math',
    grade_level: 11
  },

  // TRIGONOMETRY LESSONS
  {
    title: 'Basic Trigonometric Ratios',
    content: `# Understanding Sine, Cosine, and Tangent

Trigonometric ratios relate the angles in a right triangle to the lengths of its sides.

## The Core Ratios:

- sin θ = Opposite / Hypotenuse
- cos θ = Adjacent / Hypotenuse
- tan θ = Opposite / Adjacent = sin θ / cos θ

## Remembering the Ratios:
SOHCAHTOA:
- SOH: Sine = Opposite / Hypotenuse
- CAH: Cosine = Adjacent / Hypotenuse
- TOA: Tangent = Opposite / Adjacent

## Key Values to Memorize:
- sin 0° = 0,    cos 0° = 1,    tan 0° = 0
- sin 30° = 1/2, cos 30° = √3/2, tan 30° = 1/√3
- sin 45° = 1/√2, cos 45° = 1/√2, tan 45° = 1
- sin 60° = √3/2, cos 60° = 1/2, tan 60° = √3
- sin 90° = 1,    cos 90° = 0,    tan 90° = undefined

Example:
In a right triangle, if angle A = 30° and the hypotenuse is 10 cm, find the opposite and adjacent sides.

Opposite = 10 × sin 30° = 10 × (1/2) = 5 cm
Adjacent = 10 × cos 30° = 10 × (√3/2) = 5√3 ≈ 8.66 cm

Note: These ratios work for any right triangle, regardless of size.`,
    topic: 'trigonometry',
    subject: 'math',
    grade_level: 10
  },
  {
    title: 'The Unit Circle',
    content: `# The Unit Circle: A Powerful Tool

The unit circle is a circle with radius 1 centered at the origin. It connects trigonometry with coordinate geometry.

## Key Concepts:
- Any point on the unit circle is (cos θ, sin θ)
- Moving counterclockwise from (1,0), angle θ increases
- One complete revolution is 2π radians (360°)

## Important Angles (in Radians and Degrees):
- 0° = 0: (1, 0)
- 30° = π/6: (√3/2, 1/2)
- 45° = π/4: (1/√2, 1/√2)
- 60° = π/3: (1/2, √3/2)
- 90° = π/2: (0, 1)
- 180° = π: (-1, 0)
- 270° = 3π/2: (0, -1)
- 360° = 2π: (1, 0)

## Converting Between Degrees and Radians:
- Degrees to radians: multiply by π/180
- Radians to degrees: multiply by 180/π

Example:
Find the coordinates of the point on the unit circle at angle 120°.

120° = (120 × π/180) = 2π/3 radians

x = cos(2π/3) = cos(120°) = -1/2
y = sin(2π/3) = sin(120°) = √3/2

Coordinates: (-1/2, √3/2)

Note: The unit circle explains why sine and cosine produce waves with period 2π, and why their values repeat in predictable patterns.`,
    topic: 'trigonometry',
    subject: 'math',
    grade_level: 10
  },
  {
    title: 'Trigonometric Identities',
    content: `# Essential Trigonometric Identities

Trigonometric identities are equations that are true for all values where both sides are defined.

## Fundamental Identities:
- sin²θ + cos²θ = 1
- tan θ = sin θ / cos θ
- cot θ = cos θ / sin θ
- sec θ = 1 / cos θ
- csc θ = 1 / sin θ

## Double Angle Formulas:
- sin(2θ) = 2sin θ cos θ
- cos(2θ) = cos²θ - sin²θ = 2cos²θ - 1 = 1 - 2sin²θ

## Addition Formulas:
- sin(A + B) = sin A cos B + cos A sin B
- cos(A + B) = cos A cos B - sin A sin B

## Half Angle Formulas:
- sin(θ/2) = ±√((1 - cos θ)/2)
- cos(θ/2) = ±√((1 + cos θ)/2)

Example:
Verify sin²θ + cos²θ = 1 using the unit circle.

On the unit circle, a point at angle θ has coordinates (cos θ, sin θ).
The distance from origin to this point is 1 (radius).
Using the distance formula:
√(cos²θ + sin²θ) = 1
cos²θ + sin²θ = 1

Note: Trigonometric identities are powerful tools for simplifying expressions and solving equations. They connect different trigonometric functions in useful ways.`,
    topic: 'trigonometry',
    subject: 'math',
    grade_level: 11
  },

  // GEOMETRY LESSONS
  {
    title: 'Coordinate Geometry Basics',
    content: `# Coordinate Geometry: Points, Lines, and Distances

Coordinate geometry combines algebra and geometry using the Cartesian coordinate system.

## Key Concepts:

1. Distance Between Points:
   d = √[(x₂ - x₁)² + (y₂ - y₁)²]

2. Midpoint Formula:
   Midpoint = ((x₁ + x₂)/2, (y₁ + y₂)/2)

3. Slope of a Line:
   m = (y₂ - y₁)/(x₂ - x₁)

4. Equation of a Line:
   - Slope-intercept form: y = mx + b
   - Point-slope form: y - y₁ = m(x - x₁)
   - General form: Ax + By + C = 0

## Special Cases:
- Parallel lines have equal slopes
- Perpendicular lines have slopes that multiply to give -1
- Horizontal lines have slope 0
- Vertical lines have undefined slope

Example:
Find the distance and midpoint between A(3, 5) and B(-1, 2).

Distance:
d = √[(−1 - 3)² + (2 - 5)²]
d = √[16 + 9]
d = √25 = 5

Midpoint:
M = ((3 + (-1))/2, (5 + 2)/2)
M = (1, 3.5)

Note: Coordinate geometry allows us to solve geometric problems using algebraic methods.`,
    topic: 'geometry',
    subject: 'math',
    grade_level: 10
  },
  {
    title: 'Circles in the Coordinate Plane',
    content: `# Circles on the Coordinate Plane

A circle is the set of all points equidistant from a central point.

## Standard Equation of a Circle:
(x - h)² + (y - k)² = r²

Where:
- (h, k) is the center of the circle
- r is the radius

## Special Case:
Circle centered at origin: x² + y² = r²

## Converting General Form to Standard Form:
General form: x² + y² + Dx + Ey + F = 0

Complete the square to get standard form:
(x + D/2)² + (y + E/2)² = (D²/4 + E²/4 - F)

The center is (-D/2, -E/2) and the radius is √(D²/4 + E²/4 - F)

Example:
Find the center and radius of x² + y² - 6x + 4y - 12 = 0

Step 1: Group x and y terms
(x² - 6x) + (y² + 4y) = 12

Step 2: Complete the square for each group
(x² - 6x + 9) + (y² + 4y + 4) = 12 + 9 + 4
(x - 3)² + (y + 2)² = 25

Step 3: Identify center and radius
Center: (3, -2)
Radius: 5

Note: The distance from any point on the circle to the center equals the radius.`,
    topic: 'geometry',
    subject: 'math',
    grade_level: 10
  },
  {
    title: 'Vectors and Vector Operations',
    content: `# Vectors: Direction and Magnitude

Vectors are quantities with both magnitude and direction.

## Vector Basics:
- In 2D: v = (vₓ, vᵧ) or v = vₓi + vᵧj
- Magnitude: |v| = √(vₓ² + vᵧ²)
- Direction: θ = tan⁻¹(vᵧ/vₓ)

## Vector Operations:
1. Addition: (a, b) + (c, d) = (a + c, b + d)
2. Scalar Multiplication: k(a, b) = (ka, kb)
3. Dot Product: (a, b)·(c, d) = ac + bd
4. Cross Product (in 3D): a × b = |a||b|sin θ n̂

## Properties of Dot Product:
- a·b = |a||b|cos θ
- a·b = 0 if a and b are perpendicular
- a·b = |a||b| if a and b are parallel

Example:
If a = (3, 4) and b = (1, -2), find:
1. a + b
2. |a|
3. a·b

1. a + b = (3, 4) + (1, -2) = (4, 2)

2. |a| = √(3² + 4²) = √(9 + 16) = √25 = 5

3. a·b = (3)(1) + (4)(-2) = 3 - 8 = -5

Note: Vectors are used extensively in physics to represent forces, velocity, acceleration, and many other quantities.`,
    topic: 'geometry',
    subject: 'math',
    grade_level: 11
  },

  // STATISTICS LESSONS
  {
    title: 'Measures of Central Tendency',
    content: `# Understanding Mean, Median, and Mode

Measures of central tendency help us understand the "typical" value in a dataset.

## The Three Main Measures:

1. Mean (Average):
   - Sum all values and divide by the count
   - Formula: x̄ = (Σx)/n
   - Sensitive to outliers

2. Median:
   - Middle value when data is arranged in order
   - Not affected by extreme values
   - For even number of values, average the middle two

3. Mode:
   - Most frequently occurring value
   - A dataset can have no mode, one mode, or multiple modes
   - Only measure of central tendency for categorical data

## Choosing the Right Measure:
- Mean: Best for symmetric distributions without outliers
- Median: Best for skewed distributions or data with outliers
- Mode: Useful for categorical data or finding most common value

Example:
Dataset: 5, 8, 2, 10, 8, 25, 7

Mean:
(5 + 8 + 2 + 10 + 8 + 25 + 7) ÷ 7 = 65 ÷ 7 = 9.29

Median:
Ordered data: 2, 5, 7, 8, 8, 10, 25
Middle value: 8

Mode:
Most frequent value: 8 (occurs twice)

Note: The mean (9.29) is pulled toward the high outlier (25), while the median (8) is more representative of the typical value in this dataset.`,
    topic: 'statistics',
    subject: 'math',
    grade_level: 10
  },
  {
    title: 'Probability Fundamentals',
    content: `# Basic Probability Concepts

Probability measures the likelihood of events occurring.

## Key Definitions:
- Experiment: Process with variable outcomes
- Sample Space (S): Set of all possible outcomes
- Event (E): Subset of the sample space
- P(E): Probability of event E occurring

## Probability Rules:
1. 0 ≤ P(E) ≤ 1 for any event E
2. P(S) = 1 (something must happen)
3. P(∅) = 0 (impossible event)
4. P(E') = 1 - P(E) (complement rule)
5. P(A or B) = P(A) + P(B) - P(A and B)
6. P(A and B) = P(A) × P(B) (if independent)

## Types of Probability:
- Theoretical: Based on equally likely outcomes
  P(E) = Number of favorable outcomes / Total number of possible outcomes
- Empirical: Based on observed frequencies
  P(E) = Number of times E occurred / Total number of trials
- Subjective: Based on personal judgment

Example:
In a standard deck of 52 cards, find:
1. P(drawing a heart)
2. P(drawing a face card)
3. P(drawing a heart or a face card)

1. P(heart) = 13/52 = 1/4 = 0.25

2. P(face card) = 12/52 = 3/13 ≈ 0.231
   (Jack, Queen, King in each suit)

3. P(heart or face card):
   P(heart) + P(face card) - P(heart and face card)
   = 13/52 + 12/52 - 3/52
   = 22/52 ≈ 0.423

Note: Understanding probability helps us make decisions under uncertainty and is the foundation of statistical inference.`,
    topic: 'statistics',
    subject: 'math',
    grade_level: 10
  },
  {
    title: 'Normal Distribution',
    content: `# The Normal Distribution

The normal distribution is a continuous probability distribution that is symmetric about the mean.

## Key Properties:
- Bell-shaped curve
- Symmetric about the mean
- Mean, median, and mode are equal
- Described by two parameters: mean (μ) and standard deviation (σ)
- Notation: N(μ, σ²)

## The Standard Normal Distribution:
- Mean = 0, Standard deviation = 1
- Notation: N(0, 1)
- Any normal distribution can be converted to standard normal using z-scores

## Z-Scores:
z = (x - μ)/σ

Where:
- x is the raw score
- μ is the population mean
- σ is the population standard deviation

## Empirical Rule (68-95-99.7 Rule):
- About 68% of data falls within 1σ of the mean
- About 95% of data falls within 2σ of the mean
- About 99.7% of data falls within 3σ of the mean

Example:
IQ scores follow N(100, 15²). What percentage of people have IQ > 130?

Step 1: Convert to z-score
z = (130 - 100)/15 = 2

Step 2: Find probability
P(IQ > 130) = P(z > 2) = 1 - P(z ≤ 2)
From standard normal table: P(z ≤ 2) ≈ 0.9772
Therefore: P(IQ > 130) ≈ 1 - 0.9772 = 0.0228 = 2.28%

Note: The normal distribution is common in nature and applies to many measurements, including heights, weights, test scores, and measurement errors.`,
    topic: 'statistics',
    subject: 'math',
    grade_level: 11
  },

  // FUNCTIONS LESSONS
  {
    title: 'Function Basics',
    content: `# Understanding Functions

A function is a rule that assigns exactly one output to each input.

## Key Concepts:
- Domain: Set of all valid inputs
- Range: Set of all possible outputs
- Function notation: f(x) means "the value of f at x"
- Vertical Line Test: A graph represents a function if no vertical line intersects it more than once

## Types of Functions:
- Linear: f(x) = mx + b
- Quadratic: f(x) = ax² + bx + c
- Exponential: f(x) = aᵇˣ
- Logarithmic: f(x) = log_b(x)
- Trigonometric: f(x) = sin(x), cos(x), etc.

## Function Properties:
- Even function: f(-x) = f(x)
- Odd function: f(-x) = -f(x)
- Increasing: f(x₁) < f(x₂) when x₁ < x₂
- Decreasing: f(x₁) > f(x₂) when x₁ < x₂

Example:
Determine the domain and range of f(x) = √(9 - x²)

Domain:
For the square root to be defined, we need 9 - x² ≥ 0
9 ≥ x²
-3 ≤ x ≤ 3

Range:
When x = 0, f(0) = √9 = 3 (maximum value)
As x approaches ±3, f(x) approaches 0
Therefore, range is [0, 3]

Note: This function represents the upper half of a circle with radius 3 centered at the origin.`,
    topic: 'functions',
    subject: 'math',
    grade_level: 10
  },
  {
    title: 'Function Transformations',
    content: `# Transforming Functions

Function transformations allow us to create new functions from known ones.

## Vertical Transformations:
- Vertical shift: f(x) + k
  • k > 0: shift up by k units
  • k < 0: shift down by |k| units
- Vertical stretch/compression: a·f(x)
  • |a| > 1: vertical stretch
  • 0 < |a| < 1: vertical compression
  • a < 0: reflection about x-axis

## Horizontal Transformations:
- Horizontal shift: f(x - h)
  • h > 0: shift right by h units
  • h < 0: shift left by |h| units
- Horizontal stretch/compression: f(bx)
  • 0 < |b| < 1: horizontal stretch
  • |b| > 1: horizontal compression
  • b < 0: reflection about y-axis

## Order of Transformations:
1. Horizontal stretching/compression
2. Horizontal shifting
3. Vertical stretching/compression
4. Vertical shifting

Example:
Starting with f(x) = |x|, describe the transformations to get g(x) = 2|x - 3| + 1

Step 1: |x - 3| shifts |x| right by 3 units
Step 2: 2|x - 3| stretches vertically by factor of 2
Step 3: 2|x - 3| + 1 shifts up by 1 unit

Note: When combining transformations, horizontal ones can be tricky because they work from inside out, opposite of how we read functions.`,
    topic: 'functions',
    subject: 'math',
    grade_level: 10
  },
  {
    title: 'Composition of Functions',
    content: `# Function Composition

Function composition combines two functions to create a new function.

## Definition:
The composition (f ∘ g)(x) = f(g(x)) means:
1. Apply function g to x
2. Then apply function f to the result

## Key Properties:
- Not commutative: f ∘ g ≠ g ∘ f generally
- Associative: (f ∘ g) ∘ h = f ∘ (g ∘ h)
- Identity: f ∘ I = I ∘ f = f where I(x) = x

## Domain of Composition:
The domain of f ∘ g is all x in the domain of g where g(x) is in the domain of f.

## Finding Inverse Functions:
Functions f and g are inverses if:
- f ∘ g = g ∘ f = identity function
- f(g(x)) = g(f(x)) = x

Example:
If f(x) = 3x - 5 and g(x) = x² + 2, find:
1. (f ∘ g)(x)
2. (g ∘ f)(x)

1. (f ∘ g)(x) = f(g(x)) = f(x² + 2) = 3(x² + 2) - 5 = 3x² + 6 - 5 = 3x² + 1

2. (g ∘ f)(x) = g(f(x)) = g(3x - 5) = (3x - 5)² + 2 = 9x² - 30x + 25 + 2 = 9x² - 30x + 27

Note: Function composition is widely used in calculus (chain rule) and computer programming (pipeline of operations).`,
    topic: 'functions',
    subject: 'math',
    grade_level: 11
  },

  // NUMBER THEORY LESSONS
  {
    title: 'Sequences and Series',
    content: `# Understanding Sequences and Series

A sequence is an ordered list of numbers, and a series is the sum of a sequence.

## Types of Sequences:

1. Arithmetic Sequence:
   - Each term differs from the previous by a constant d
   - General term: aₙ = a₁ + (n - 1)d
   - Sum: Sₙ = n/2(a₁ + aₙ) = n/2(2a₁ + (n - 1)d)

2. Geometric Sequence:
   - Each term is a constant multiple r of the previous
   - General term: aₙ = a₁ × rⁿ⁻¹
   - Sum: Sₙ = a₁(1 - rⁿ)/(1 - r) (when r ≠ 1)
   - Infinite sum: S∞ = a₁/(1 - r) (when |r| < 1)

3. Fibonacci Sequence:
   - Each term is the sum of the two previous terms
   - First terms: 1, 1, 2, 3, 5, 8, 13, 21, ...
   - Formula: Fₙ₊₂ = Fₙ₊₁ + Fₙ

Example:
Find the sum of the first 10 terms of the arithmetic sequence: 5, 8, 11, 14, ...

Step 1: Identify first term and common difference
a₁ = 5, d = 3

Step 2: Find the 10th term
a₁₀ = 5 + (10 - 1)3 = 5 + 27 = 32

Step 3: Calculate the sum
S₁₀ = 10/2(5 + 32) = 5(37) = 185

Note: Sequences appear in many real-world contexts, from compound interest to population growth.`,
    topic: 'number_theory',
    subject: 'math',
    grade_level: 11
  },
  {
    title: 'Exponential and Logarithmic Functions',
    content: `# Exponents and Logarithms

Exponential and logarithmic functions are inverses of each other and model many natural phenomena.

## Exponential Functions:
- Form: f(x) = aᵇˣ
- a > 0, b > 0, b ≠ 1
- Always passes through (0, a)
- If b > 1: increasing function
- If 0 < b < 1: decreasing function

## Logarithmic Functions:
- Form: g(x) = log_b(x)
- Domain: x > 0
- Passes through (1, 0)
- If b > 1: increasing slowly
- If 0 < b < 1: decreasing slowly

## Key Properties:
1. log_b(xy) = log_b(x) + log_b(y)
2. log_b(x/y) = log_b(x) - log_b(y)
3. log_b(xⁿ) = n·log_b(x)
4. log_b(b) = 1
5. log_b(1) = 0
6. b^(log_b(x)) = x
7. log_b(b^x) = x

## Common Bases:
- Natural (base e): ln(x)
- Base 10: log(x) or log₁₀(x)
- Base 2: log₂(x) (common in computer science)

Example:
Solve for x: 3ˣ = 27

Taking log base 3 of both sides:
log₃(3ˣ) = log₃(27)
x = log₃(27)
x = log₃(3³)
x = 3·log₃(3)
x = 3·1
x = 3

Note: Exponential functions model growth (population, compound interest) and decay (radioactive materials), while logarithms are used in measuring earthquake intensity (Richter scale), sound intensity (decibels), and pH.`,
    topic: 'number_theory',
    subject: 'math',
    grade_level: 10
  }
];

// Default export to make the initial data accessible
export default INITIAL_LESSONS;
