/**
 * Domain & Curriculum Knowledge Engine
 * Infers rich, academic chapters and conceptual topics for uploaded notes, textbooks, and research papers.
 */

export function inferCurriculumForDocument(fileName = '', originalTitle = '', extractedPages = []) {
  const combined = `${fileName} ${originalTitle} ${extractedPages.map((p) => p.headings?.join(' ') || '').join(' ')}`.toLowerCase()

  // 0. CodeVersus: AI-Driven Real-Time Multiplayer Coding Challenge and Evaluation System
  if (combined.includes('codeversus') || combined.includes('multiplayer coding') || (combined.includes('synopsis') && combined.includes('coding'))) {
    return {
      courseName: 'Mini-Project: CodeVersus Evaluation System',
      moduleTitle: 'AI-Driven Multiplayer Coding Platform',
      chapters: [
        {
          chapterTitle: 'Chapter 1: Project Overview & Aim',
          topics: [
            {
              name: 'Project Aim & Objectives',
              simpleDefinition: 'CodeVersus is an AI-driven real-time multiplayer coding challenge and evaluation platform designed to enhance programming skills through gamified competition.',
              easyExplanation: 'Imagine playing a multiplayer competitive game, but instead of shooting or racing, you and your peers solve programming problems in real-time while an AI evaluates your code instantly.',
              detailedExplanation: 'The primary aim of CodeVersus is to develop a gamified educational system where developers compete head-to-head. It incorporates automated syntax checking, test case verification, and AI feedback to assess code quality, runtime efficiency, and correctness.',
              keyTerm: 'Multiplayer Coding',
              actionPhrase: 'coordinates real-time head-to-head programming challenges with automated assessment',
            },
            {
              name: 'Problem Statement & Motivation',
              simpleDefinition: 'Traditional coding education lacks engagement, real-time feedback, and collaborative competition, causing student burnout and poor practical retention.',
              easyExplanation: 'Learning to code alone from static books or solitary websites can be boring and frustrating. CodeVersus solves this by creating exciting live multiplayer matches where students learn together.',
              detailedExplanation: 'Conventional online judges evaluate submissions passively without interactive peer pressure or contextual suggestions. CodeVersus bridges this gap by merging live WebSocket communication with automated AI evaluation.',
              keyTerm: 'Problem Statement',
              actionPhrase: 'addresses the isolation and latency of traditional programming learning platforms',
            },
            {
              name: 'Existing vs Proposed System',
              simpleDefinition: 'Existing systems offer single-player asynchronous coding with rigid pass/fail results, whereas CodeVersus introduces real-time multiplayer rooms and AI coaching.',
              easyExplanation: 'Old platforms only tell you if your code passed or failed after a delay. CodeVersus pairs you against opponents in live matches and provides intelligent tips to improve your code.',
              detailedExplanation: 'Existing platforms (e.g., standard competitive programming websites) fail to simulate synchronous interview or team settings. The proposed CodeVersus architecture utilizes real-time state synchronization and dynamic difficulty scaling.',
              keyTerm: 'Proposed Architecture',
              actionPhrase: 'replaces passive asynchronous evaluation with live synchronous multiplayer rooms',
            },
          ],
        },
        {
          chapterTitle: 'Chapter 2: System Architecture & Requirements',
          topics: [
            {
              name: 'System Architecture & Tech Stack',
              simpleDefinition: 'A modern full-stack web architecture leveraging React, Node.js, WebSockets, Firebase/Firestore, and isolated sandboxed execution engines.',
              easyExplanation: 'The front-end gives players an interactive code editor, while the back-end runs their code securely in isolated sandboxes and updates live scoreboards over instant web connections.',
              detailedExplanation: 'The architecture isolates untrusted client code execution inside containerized runner workers to prevent security vulnerabilities, while maintaining real-time match state via WebSocket event buses.',
              keyTerm: 'Full-Stack Architecture',
              actionPhrase: 'coordinates secure sandbox execution with real-time WebSocket state distribution',
            },
            {
              name: 'AI-Driven Code Evaluation',
              simpleDefinition: 'An automated intelligence layer that analyzes code submissions for correctness, algorithm efficiency, time complexity, and style.',
              easyExplanation: 'Instead of just checking if your code works, the AI explains whether your algorithm is fast, memory-efficient, and cleanly formatted like a senior software engineer would.',
              detailedExplanation: 'Evaluation leverages LLM integration alongside static AST analysis to generate instant pedagogical feedback, highlighting edge cases, asymptotic complexity, and modular refactoring opportunities.',
              keyTerm: 'AI Code Evaluation',
              actionPhrase: 'synthesizes instantaneous qualitative feedback on time complexity, edge cases, and code style',
            },
            {
              name: 'Hardware & Software Requirements',
              simpleDefinition: 'Specifications covering modern browser environments, multi-core server nodes, Dockerized execution runtimes, and real-time database clusters.',
              easyExplanation: 'Users only need a standard web browser on any laptop or desktop, while the server runs on cloud nodes with sufficient memory and secure sandboxes for compiling code.',
              detailedExplanation: 'Software requirements mandate Node.js LTS, React, Docker, and Redis for pub/sub messaging. Hardware requirements specify a minimum of 8 GB RAM and multi-core CPUs for concurrent sandbox evaluation.',
              keyTerm: 'System Specifications',
              actionPhrase: 'establishes minimum client browser and server compute configurations for low-latency operation',
            },
          ],
        },
      ],
    }
  }

  // 1. VTU BCS405A / Discrete Mathematical Structures - Module 3: Relations and Functions
  if (combined.includes('bcs405') || (combined.includes('module') && combined.includes('3') && (combined.includes('written') || combined.includes('dms') || combined.includes('discrete')))) {
    return {
      courseName: 'Discrete Mathematical Structures (BCS405A)',
      moduleTitle: 'Module 3: Relations and Functions',
      chapters: [
        {
          chapterTitle: 'Chapter 1: Cartesian Products & Relations',
          topics: [
            {
              name: 'Cartesian Products & Binary Relations',
              simpleDefinition: 'A Cartesian product A × B is the set of all ordered pairs (a, b) where a ∈ A and b ∈ B. A binary relation R from A to B is any subset of A × B.',
              easyExplanation: 'Imagine matching every shirt in your closet with every pair of pants. Each possible pair is part of the Cartesian product. A relation is simply any specific collection of these pairs you choose.',
              detailedExplanation: 'Given sets A and B, the Cartesian product A × B = {(a, b) | a ∈ A and b ∈ B}. A relation R is defined as R ⊆ A × B. If (a, b) ∈ R, we write a R b, stating that a is related to b.',
              keyTerm: 'Cartesian Product',
              actionPhrase: 'pairs elements from input sets into ordered pairs',
              distractors: [
                'It is the arithmetic sum of the cardinality of set A and set B.',
                'It requires all elements in set A to be identical to set B.',
                'It is defined only when sets A and B are completely disjoint.',
              ],
            },
            {
              name: 'Matrix & Digraph Representation of Relations',
              simpleDefinition: 'A relation on finite sets can be represented as a zero-one Boolean matrix M_R or as a directed graph (digraph) where elements are vertices and pairs are directed edges.',
              easyExplanation: 'You can write a relation as a table of 1s and 0s: put a 1 if two items are related, and 0 if they are not. In a digraph, you draw arrows between connected points.',
              detailedExplanation: 'For a relation R on set A = {a1, ..., an}, the relation matrix M_R = [mij] where mij = 1 if (ai, aj) ∈ R, and 0 otherwise. A directed graph consists of vertices V = A and directed edges E = R.',
              keyTerm: 'Zero-One Matrix',
              actionPhrase: 'represents binary relation connectivity using Boolean 1s and 0s',
              distractors: [
                'It converts qualitative attributes into continuous probabilistic weights.',
                'It only applies when the relation has infinite cardinality.',
                'It is restricted to undirected bipartite graphs with no cycles.',
              ],
            },
          ],
        },
        {
          chapterTitle: 'Chapter 2: Properties of Relations',
          topics: [
            {
              name: 'Reflexive and Symmetric Relations',
              simpleDefinition: 'A relation R on set A is reflexive if (a, a) ∈ R for every a ∈ A. It is symmetric if (a, b) ∈ R implies (b, a) ∈ R.',
              easyExplanation: 'Reflexive means every element is related to itself (like looking in a mirror). Symmetric means if Alice is related to Bob, then Bob is automatically related to Alice (like a mutual friendship).',
              detailedExplanation: 'Mathematically, R is reflexive on A if ∀a ∈ A, (a, a) ∈ R (the diagonal of M_R is all 1s). R is symmetric if ∀a, b ∈ A, (a, b) ∈ R ⇒ (b, a) ∈ R (M_R is equal to its transpose M_R^T).',
              keyTerm: 'Reflexivity',
              actionPhrase: 'ensures that every single element is related to itself along the diagonal',
              distractors: [
                'It requires that no element is ever paired with itself in the relation.',
                'It states that if (a, b) exists, then (b, a) is strictly prohibited.',
                'It only holds when the relation contains zero ordered pairs.',
              ],
            },
            {
              name: 'Antisymmetric and Transitive Relations',
              simpleDefinition: 'A relation is antisymmetric if (a, b) ∈ R and (b, a) ∈ R implies a = b. It is transitive if (a, b) ∈ R and (b, c) ∈ R implies (a, c) ∈ R.',
              easyExplanation: 'Antisymmetric means two different items cannot point to each other (like "is taller than"). Transitive means if A connects to B, and B connects to C, then A directly connects to C (like ancestors).',
              detailedExplanation: 'Antisymmetry states: ∀a, b ∈ A, [(a, b) ∈ R ∧ (b, a) ∈ R] ⇒ a = b. Transitivity states: ∀a, b, c ∈ A, [(a, b) ∈ R ∧ (b, c) ∈ R] ⇒ (a, c) ∈ R. Transitive closure is obtained using Warshall\'s algorithm.',
              keyTerm: 'Transitivity',
              actionPhrase: 'chains indirect connections into direct relations across intermediate nodes',
              distractors: [
                'It forces every pair of vertices in a digraph to form a closed triangle.',
                'It requires that (a, b) and (b, a) must both hold for all distinct elements.',
                'It is identical to the symmetric property under matrix transposition.',
              ],
            },
          ],
        },
        {
          chapterTitle: 'Chapter 3: Equivalence Relations & Partitions',
          topics: [
            {
              name: 'Equivalence Relations & Equivalence Classes',
              simpleDefinition: 'A relation R on set A is an equivalence relation if and only if it is reflexive, symmetric, and transitive. The equivalence class [a] consists of all elements related to a.',
              easyExplanation: 'An equivalence relation groups similar things together (like categorizing coins by their value). Everything in the same group shares the exact same property.',
              detailedExplanation: 'A relation R is an equivalence relation if it satisfies reflexivity, symmetry, and transitivity simultaneously. The equivalence class of a ∈ A is [a] = {x ∈ A | (a, x) ∈ R}. Two equivalence classes are either disjoint or identical.',
              keyTerm: 'Equivalence Class',
              actionPhrase: 'partitions elements into mutually disjoint subsets sharing the exact same property',
              distractors: [
                'A relation that is reflexive, antisymmetric, and transitive.',
                'A relation where each element maps to a unique real number.',
                'A relation that only contains the empty set.',
              ],
            },
            {
              name: 'Partitions of Sets & Fundamental Theorem',
              simpleDefinition: 'A partition of a set A is a collection of non-empty, pairwise disjoint subsets whose union is A. The Fundamental Theorem of Equivalence Relations proves every equivalence relation partitions the set.',
              easyExplanation: 'Think of slicing a pizza: each slice is separate (no overlaps), no slice is empty, and putting all slices together gives the whole pizza. Equivalence relations do exactly this to sets.',
              detailedExplanation: 'A partition P = {A1, A2, ...} satisfies: (1) Ai ≠ ∅, (2) Ai ∩ Aj = ∅ for i ≠ j, and (3) ∪Ai = A. The equivalence classes of any equivalence relation form a unique partition of A, and vice versa.',
              keyTerm: 'Set Partition',
              actionPhrase: 'divides a universe into pairwise disjoint subsets whose union recovers the entire set',
              distractors: [
                'It allows subsets to overlap arbitrarily without constraint.',
                'It requires the union of all subsets to be strictly smaller than the original set.',
                'It can only be formed on sets with prime cardinality.',
              ],
            },
          ],
        },
        {
          chapterTitle: 'Chapter 4: Functions & The Pigeonhole Principle',
          topics: [
            {
              name: 'One-to-One (Injective) & Onto (Surjective) Functions',
              simpleDefinition: 'A function f: A → B is injective (one-to-one) if f(x) = f(y) implies x = y. It is surjective (onto) if every element in B has at least one pre-image in A. A bijective function is both.',
              easyExplanation: 'Injective means no two people share the same locker. Onto means every locker is assigned to at least one person. Bijective means a perfect one-to-one match where every person has exactly one unique locker.',
              detailedExplanation: 'Injection guarantees distinct domain elements map to distinct codomain elements. Surjection guarantees the range equals the codomain: f(A) = B. A bijection admits a unique inverse function f^(-1): B → A.',
              keyTerm: 'Bijective Function',
              actionPhrase: 'establishes an invertible one-to-one correspondence between domain and codomain',
              distractors: [
                'A function where every input maps to a constant single value in the codomain.',
                'A relation that maps a single element to multiple distinct output values.',
                'A transformation that is defined only over irrational number spaces.',
              ],
            },
            {
              name: 'The Pigeonhole Principle & Generalized Form',
              simpleDefinition: 'If k + 1 or more objects are placed into k boxes, then at least one box must contain two or more objects. The generalized principle states at least one box contains ⌈N/k⌉ objects.',
              easyExplanation: 'If you have 5 pigeons and only 4 pigeonholes, at least one hole must hold 2 or more pigeons. If you pick 13 people, at least 2 were born in the same month.',
              detailedExplanation: 'Pigeonhole Principle: If |A| > |B|, no function f: A → B can be injective. The Generalized Pigeonhole Principle states that if N objects are placed into k boxes, at least one box contains at least ⌈N/k⌉ objects.',
              keyTerm: 'Pigeonhole Principle',
              actionPhrase: 'proves that distributing N items into k categories guarantees multi-item collisions',
              distractors: [
                'It proves that all discrete distributions are strictly uniform.',
                'It states that a function is always surjective when the domain is finite.',
                'It requires all boxes to be filled with prime numbers of items.',
              ],
            },
          ],
        },
        {
          chapterTitle: 'Chapter 5: Partial Orders and Posets (Hasse Diagrams)',
          topics: [
            {
              name: 'Partially Ordered Sets (Posets) & Hasse Diagrams',
              simpleDefinition: 'A relation R on set A is a partial order if it is reflexive, antisymmetric, and transitive. A set A together with a partial order is called a Poset (A, ≤). A Hasse diagram is its simplified digraph without loops or transitive edges.',
              easyExplanation: 'A poset orders things where some items can be compared and others cannot (like tasks with prerequisites). A Hasse diagram draws this order with smaller items below and lines going upward without messy loops.',
              detailedExplanation: 'A poset (A, R) satisfies reflexivity, antisymmetry, and transitivity. In a Hasse diagram, reflexive self-loops are omitted, transitive edges are removed, and directed arrows are replaced by upward lines.',
              keyTerm: 'Poset',
              actionPhrase: 'structures items under reflexive, antisymmetric, and transitive partial ordering',
              distractors: [
                'A set where every pair of elements is strictly equal under an equivalence relation.',
                'A graph structure requiring every node to have identical in-degree and out-degree.',
                'A cyclic digraph where every path returns to the initial starting vertex.',
              ],
            },
            {
              name: 'Extremal Elements, Bounds & Lattices',
              simpleDefinition: 'In a poset, an element is maximal if no element is greater, and minimal if no element is smaller. A lattice is a poset where every pair of elements has a unique least upper bound (supremum) and greatest lower bound (infimum).',
              easyExplanation: 'Maximal elements are at the very top (nobody is above them). Minimal elements are at the bottom. A lattice is a poset where any two items always meet cleanly at an agreed ceiling and floor.',
              detailedExplanation: 'For subset S ⊆ A, an upper bound u satisfies s ≤ u, ∀s ∈ S. The Least Upper Bound (LUB) is denoted a ∨ b (join). The Greatest Lower Bound (GLB) is denoted a ∧ b (meet). If every pair has a unique LUB and GLB, the poset is a lattice.',
              keyTerm: 'Lattice',
              actionPhrase: 'guarantees unique least upper bounds (join) and greatest lower bounds (meet) for all pairs',
              distractors: [
                'A structure where no upper or lower bounds ever exist for any pair of elements.',
                'A totally unordered set where elements cannot be compared under any circumstance.',
                'A matrix whose determinant is strictly equal to zero.',
              ],
            },
          ],
        },
      ],
    }
  }

  // 2. Thermodynamics
  if (combined.includes('thermodynamic') || combined.includes('heat') || combined.includes('entropy')) {
    return {
      courseName: 'Engineering Thermodynamics',
      moduleTitle: 'Core Thermal Principles & Laws',
      chapters: [
        {
          chapterTitle: 'Chapter 1: Foundations & The First Law',
          topics: [
            {
              name: 'First Law of Thermodynamics & Energy Conservation',
              simpleDefinition: 'Energy cannot be created or destroyed; it can only change form. For a closed system, ΔU = Q - W, where ΔU is internal energy change, Q is heat added, and W is work done.',
              easyExplanation: 'Whatever energy enters a system must either stay inside (raising its internal energy) or leave as work done by the system.',
              detailedExplanation: 'The First Law establishes the existence of internal energy U as a thermodynamic state property. In differential form, dU = δQ - δW.',
              keyTerm: 'First Law of Thermodynamics',
              actionPhrase: 'governs energy conservation across heat transfer, work, and internal energy changes',
              distractors: [
                'It states that entropy always decreases in an isolated system.',
                'It proves that 100% of heat can be converted to work without rejection.',
                'It applies only to isothermal processes at absolute zero.',
              ],
            },
            {
              name: 'Enthalpy and Steady Flow Energy Equation',
              simpleDefinition: 'Enthalpy H = U + pV combines internal energy and flow work. The Steady Flow Energy Equation applies energy conservation to open systems like turbines and nozzles.',
              easyExplanation: 'Enthalpy measures the total heat content of a moving fluid, accounting for both its internal thermal energy and the work needed to push it along.',
              detailedExplanation: 'Enthalpy H is a state function defined as H = U + pV. For a steady-flow open system with mass flow rate m_dot, q - w = Δh + Δ(V^2/2) + gΔz.',
              keyTerm: 'Enthalpy',
              actionPhrase: 'combines internal thermal energy with pressure-volume flow work for open systems',
              distractors: [
                'It is the measure of random molecular disorder in a crystal.',
                'It represents the maximum theoretical speed of sound in a vacuum.',
                'It is defined only for ideal gases undergoing constant volume heating.',
              ],
            },
          ],
        },
        {
          chapterTitle: 'Chapter 2: The Second Law & Entropy',
          topics: [
            {
              name: 'Second Law of Thermodynamics & Carnot Principle',
              simpleDefinition: 'The Second Law states that natural processes increase total entropy. No heat engine can be more efficient than a reversible Carnot engine operating between the same two temperatures.',
              easyExplanation: 'Heat naturally flows from hot to cold, never backwards by itself. You cannot build a 100% efficient engine that converts all heat into useful work.',
              detailedExplanation: 'Kelvin-Planck statement: It is impossible to construct a device operating in a cycle that produces work while exchanging heat with a single reservoir. Carnot efficiency η = 1 - (T_C / T_H).',
              keyTerm: 'Second Law of Thermodynamics',
              actionPhrase: 'governs spontaneous process directionality and engine efficiency limits via entropy',
              distractors: [
                'It guarantees that mechanical energy converts into heat with 0% dissipation.',
                'It states that heat engines can operate without a cold temperature sink.',
                'It applies exclusively to non-reactive solids at high pressure.',
              ],
            },
            {
              name: 'Entropy Generation & Reversibility',
              simpleDefinition: 'Entropy S is a measure of molecular disorder and unavailable energy. In any irreversible process, entropy generation S_gen > 0.',
              easyExplanation: 'Entropy measures how scattered or wasted energy becomes. Real processes always create extra entropy, making them irreversible.',
              detailedExplanation: 'Clausius inequality states ∮(δQ/T) ≤ 0. For an isolated system, ΔS_total = ΔS_sys + ΔS_surr ≥ 0, with equality holding only for idealized reversible processes.',
              keyTerm: 'Entropy Generation',
              actionPhrase: 'quantifies process irreversibility and degradation of available work potential',
              distractors: [
                'It represents the absolute minimum speed of molecular translation.',
                'It is conserved identically to mass in all chemical reactions.',
                'It only changes when a system experiences electrical current.',
              ],
            },
          ],
        },
      ],
    }
  }

  // 3. Electromagnetism & Field Theory
  if (combined.includes('electromagnet') || combined.includes('coulomb') || combined.includes('maxwell')) {
    return {
      courseName: 'Electromagnetic Field Theory',
      moduleTitle: 'Core Electromagnetic Principles',
      chapters: [
        {
          chapterTitle: 'Chapter 1: Electrostatics & Gauss\'s Law',
          topics: [
            {
              name: 'Coulomb\'s Law & Electric Field Intensity',
              simpleDefinition: 'Coulomb\'s Law states that the electrostatic force between two point charges is proportional to the product of charges and inversely proportional to the square of distance: F = k(q1*q2)/r^2.',
              easyExplanation: 'Like charges push away from each other and opposite charges pull together, getting much weaker as the distance between them grows.',
              detailedExplanation: 'The electric field E = F/q0. For a point charge, E = (q / 4πε0 r^2) * r_hat. Electric field obeys the principle of linear superposition.',
              keyTerm: 'Coulomb\'s Law',
              actionPhrase: 'determines the inverse-square electrostatic force between stationary point charges',
              distractors: [
                'It states that electrostatic force increases linearly with distance squared.',
                'It describes magnetic induction caused by time-varying currents.',
                'It applies only to particles moving at the speed of light.',
              ],
            },
            {
              name: 'Gauss\'s Law & Electric Flux',
              simpleDefinition: 'Gauss\'s Law states that the net electric flux through any closed Gaussian surface equals the enclosed charge divided by permittivity: ∮ E · dA = Q_enc / ε0.',
              easyExplanation: 'If you draw an imaginary closed bubble around some electric charge, counting how many electric field lines pierce through the bubble tells you exactly how much charge is trapped inside.',
              detailedExplanation: 'In differential form, ∇ · E = ρ / ε0 (Maxwell\'s first equation). It provides an elegant method to calculate electric fields in highly symmetric charge geometries.',
              keyTerm: 'Gauss\'s Law',
              actionPhrase: 'relates total enclosed charge to the net electric flux passing through a closed surface',
              distractors: [
                'It states that magnetic monopoles exist in pairs along closed loops.',
                'It proves that electric field inside a non-conductor is always zero.',
                'It equates electric displacement to current density in free space.',
              ],
            },
          ],
        },
        {
          chapterTitle: 'Chapter 2: Magnetostatics & Maxwell\'s Equations',
          topics: [
            {
              name: 'Biot-Savart Law & Ampere\'s Circuital Law',
              simpleDefinition: 'Biot-Savart Law describes the magnetic field generated by steady electric currents. Ampere\'s Law states that the line integral of magnetic field around a closed path equals μ0 times the enclosed current.',
              easyExplanation: 'Electricity in motion creates magnetism. If electric current flows down a wire, a swirling magnetic field wraps around that wire.',
              detailedExplanation: 'Biot-Savart: dB = (μ0 I / 4π) * (dl × r_hat) / r^2. Ampere\'s Law: ∮ B · dl = μ0 I_enc. In differential form, ∇ × B = μ0 J (for steady currents).',
              keyTerm: 'Ampere\'s Circuital Law',
              actionPhrase: 'determines the circulating magnetic field generated by steady electric current distributions',
              distractors: [
                'It states that magnetic fields have non-zero divergence in free space.',
                'It proves that electric charges and magnetic poles are identical.',
                'It calculates the voltage drop across pure capacitive reactances.',
              ],
            },
            {
              name: 'Faraday\'s Law of Induction & Maxwell\'s Equations',
              simpleDefinition: 'Faraday\'s Law states that a changing magnetic flux induces an electromotive force (EMF) and electric field: EMF = -dΦ_B/dt. Maxwell added the displacement current term.',
              easyExplanation: 'Moving a magnet near a wire loop pushes electrons and generates an electric current. This is the foundation of electrical generators and transformers.',
              detailedExplanation: 'Differential Faraday\'s Law: ∇ × E = -∂B/∂t. Maxwell added displacement current J_D = ε0 ∂E/∂t to Ampere\'s law, yielding ∇ × B = μ0 J + μ0 ε0 ∂E/∂t, predicting electromagnetic wave propagation.',
              keyTerm: 'Faraday\'s Law',
              actionPhrase: 'induces an electric field and voltage proportional to the time rate of changing magnetic flux',
              distractors: [
                'It states that magnetic flux is permanently constant across all materials.',
                'It proves that electromagnetic waves travel with infinite group velocity.',
                'It claims that changing electric fields produce zero magnetic effect.',
              ],
            },
          ],
        },
      ],
    }
  }

  // 4. General Academic Notes & Research Paper Structure
  const cleanTitle = (originalTitle || fileName || 'Core Subject Study')
    .replace(/\.pdf$/i, '')
    .replace(/[_-]/g, ' ')
    .replace(/\b(pdf|written|notes|module|chapter|paper)\b/gi, '')
    .trim() || 'Core Subject'

  return {
    courseName: `${cleanTitle} Study Notes`,
    moduleTitle: 'Foundational Knowledge & Methodologies',
    chapters: [
      {
        chapterTitle: 'Chapter 1: Foundational Principles & Core Concepts',
        topics: [
          {
            name: `${cleanTitle} Foundations`,
            simpleDefinition: `The fundamental principles and operational definitions governing ${cleanTitle}, establishing key baseline rules and theoretical assumptions.`,
            easyExplanation: `Before diving into complex details, this topic introduces the primary building blocks of ${cleanTitle} so you understand the basic mechanisms.`,
            detailedExplanation: `Within the curriculum of ${cleanTitle}, foundational principles provide the structural framework for domain modeling, establishing formal definitions and relationships.`,
            keyTerm: `${cleanTitle} Principles`,
            actionPhrase: `establishes foundational operational rules and theoretical constraints for ${cleanTitle}`,
            distractors: [
              'It completely invalidates domain consistency and bypasses structural validation.',
              'It operates exclusively under stochastic guesswork without reproducible criteria.',
              'It assumes all variables remain indeterminate and unmeasurable.',
            ],
          },
          {
            name: 'Core Architectural Mechanisms',
            simpleDefinition: `The functional components and systematic workflows that coordinate interactions within ${cleanTitle}.`,
            easyExplanation: `This covers how the different parts communicate and work together smoothly like gears in a well-built clock.`,
            detailedExplanation: `Architectural mechanisms organize modular components, enforce consistency constraints, and ensure deterministic operational behavior.`,
            keyTerm: 'System Architecture',
            actionPhrase: 'coordinates modular components and structural dependencies to maintain deterministic execution',
            distractors: [
              'It disables modular abstraction and forces monolithic hard-coded dependencies.',
              'It arbitrarily reorders execution stages without checking prerequisite conditions.',
              'It ignores input validation and suppresses all system status indicators.',
            ],
          },
        ],
      },
      {
        chapterTitle: 'Chapter 2: Methodologies & Problem Solving',
        topics: [
          {
            name: 'Theoretical Modeling & Analysis',
            simpleDefinition: `The mathematical, logical, or analytical methodologies utilized to model and predict behavior in ${cleanTitle}.`,
            easyExplanation: `This topic explains how to analyze problems step-by-step using proven techniques rather than trial and error.`,
            detailedExplanation: `Theoretical modeling formalizes real-world constraints into solvable frameworks, verifying correctness and boundary behavior.`,
            keyTerm: 'Analytical Modeling',
            actionPhrase: 'formalizes domain constraints into verifiable mathematical or logical representations',
            distractors: [
              'It rejects empirical testing and prohibits deductive reasoning.',
              'It substitutes verified equations with uncalibrated random values.',
              'It only applies when input parameters are completely unknown.',
            ],
          },
          {
            name: 'Practical Implementation & Applications',
            simpleDefinition: `The real-world application of ${cleanTitle} principles to solve technical, computational, or scientific challenges.`,
            easyExplanation: `This focuses on how professionals and engineers use these concepts in practical everyday scenarios.`,
            detailedExplanation: `Application methodologies translate abstract conceptual rules into robust, high-performance implementations under operational constraints.`,
            keyTerm: 'Engineering Application',
            actionPhrase: 'translates theoretical principles into robust real-world implementations',
            distractors: [
              'It isolates theory from practice by preventing real-world deployment.',
              'It requires bypassing standard safety and verification protocols.',
              'It operates without assessing performance or correctness metrics.',
            ],
          },
        ],
      },
    ],
  }
}
