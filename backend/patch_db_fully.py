import sqlite3
import os
import random

def patch_db_fully():
    db_path = 'exam_architect.db'
    if not os.path.exists(db_path):
        db_path = 'backend/exam_architect.db'
        
    print(f"Opening database for full premium patching: {db_path}")
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    # 1. Update Question ID 517 (GATE CS 2013 Q3 - Vandermonde determinant)
    q3_text = (
        "Q.3\nWhich one of the following determinants does NOT equal the Vandermonde determinant:\n\n"
        "| 1   x   x² |\n"
        "| 1   y   y² |\n"
        "| 1   z   z² |\n\n"
        "(A)\n"
        "| 1  x(x+1)  x+1 |\n"
        "| 1  y(y+1)  y+1 |\n"
        "| 1  z(z+1)  z+1 |\n\n"
        "(B)\n"
        "| 1  x+1  x²+1 |\n"
        "| 1  y+1  y²+1 |\n"
        "| 1  z+1  z²+1 |\n\n"
        "(C)\n"
        "| 0  x-y  x²-y² |\n"
        "| 0  y-z  y²-z² |\n"
        "| 1   z     z²   |\n\n"
        "(D)\n"
        "| 2  x+y  x²+y² |\n"
        "| 2  y+z  y²+z² |\n"
        "| 1   z     z²   |"
    )
    cursor.execute("""
        UPDATE questions 
        SET question_text = ?, correct_answer = ?, question_style = 'MCQ'
        WHERE id = 517
    """, (q3_text, "A"))
    print("Patched Q3 (Vandermonde determinant question) successfully.")

    # 2. Diversified Question Templates by Topic / Chapter
    templates = {
        "Graph Theory": [
            {
                "text": "Which of the following is true for any simple, undirected planar graph with V vertices (V >= 3) and E edges?\n(A) E <= 3V - 6\n(B) E >= 3V - 6\n(C) E <= V - 3\n(D) E >= 2V - 4",
                "style": "MCQ", "ans": "A"
            },
            {
                "text": "What is the maximum number of edges in a bipartite graph with V vertices?\n(A) V²/4\n(B) V²/2\n(C) V(V-1)/2\n(D) 2V",
                "style": "MCQ", "ans": "A"
            },
            {
                "text": "A tree with N vertices has how many edges?\n(A) N - 1\n(B) N\n(C) log(N)\n(D) N/2",
                "style": "MCQ", "ans": "A"
            },
            {
                "text": "An undirected graph G is Eulerian if and only if:\n(A) All vertices have even degree\n(B) G has a Hamiltonian cycle\n(C) G is planar\n(D) All vertices have odd degree",
                "style": "MCQ", "ans": "A"
            }
        ],
        "Mathematical Logic": [
            {
                "text": "The propositional logic formula P ∨ ~P is:\n(A) A tautology\n(B) A contradiction\n(C) Contingent\n(D) Invalid",
                "style": "MCQ", "ans": "A"
            },
            {
                "text": "If P -> Q is false, then the truth values of P and Q are respectively:\n(A) True, False\n(B) False, True\n(C) True, True\n(D) False, False",
                "style": "MCQ", "ans": "A"
            },
            {
                "text": "Which of the following is logically equivalent to the implication P -> Q?\n(A) ~P ∨ Q\n(B) ~Q -> ~P\n(C) P ∧ ~Q\n(D) ~P ∧ Q",
                "style": "MCQ", "ans": "A"
            }
        ],
        "Set Theory & Algebra": [
            {
                "text": "Let A and B be finite sets. The number of all possible relations from A to B is:\n(A) 2^(|A| * |B|)\n(B) 2^(|A| + |B|)\n(C) |A| * |B|\n(D) 2^|A| * 2^|B|",
                "style": "MCQ", "ans": "A"
            },
            {
                "text": "Which of the following algebraic structures is a Monoid but NOT a Group under addition?\n(A) Set of Natural Numbers (N)\n(B) Set of Integers (Z)\n(C) Set of Real Numbers (R)\n(D) Set of Complex Numbers (C)",
                "style": "MCQ", "ans": "A"
            }
        ],
        "Linear Algebra": [
            {
                "text": "Let A be an n x n real matrix. If A² = A, then the eigenvalues of G can only be:\n(A) 0 or 1\n(B) -1 or 1\n(C) 0 or -1\n(D) Any real number",
                "style": "MCQ", "ans": "A"
            },
            {
                "text": "If a 3 x 3 matrix has determinant equal to 5, what is the determinant of 2A?\n(A) 40\n(B) 10\n(C) 20\n(D) 5",
                "style": "MCQ", "ans": "A"
            },
            {
                "text": "What is the rank of a 4 x 4 matrix where all entries are equal to 3?\n(A) 1\n(B) 4\n(C) 0\n(D) 3",
                "style": "MCQ", "ans": "A"
            }
        ],
        "Probability & Statistics": [
            {
                "text": "If a fair coin is tossed 3 times, what is the probability of getting at least two heads?\n(A) 0.5\n(B) 0.375\n(C) 0.75\n(D) 0.625",
                "style": "MCQ", "ans": "A"
            },
            {
                "text": "For two independent events A and B, P(A ∩ B) is equal to:\n(A) P(A) * P(B)\n(B) P(A) + P(B)\n(C) P(A) / P(B)\n(D) P(A) + P(B) - P(A ∪ B)",
                "style": "MCQ", "ans": "A"
            }
        ],
        "Calculus": [
            {
                "text": "What is the limit of (sin x) / x as x approaches 0?\n(A) 1\n(B) 0\n(C) Infinity\n(D) Does not exist",
                "style": "MCQ", "ans": "A"
            }
        ],
        "Memory Hierarchy (Cache, Virtual Memory)": [
            {
                "text": "In a 32-bit byte-addressable system, a 4-way set associative cache of size 16 KB is designed with block size of 64 bytes. What is the length of the index field in bits?\n(A) 6 bits\n(B) 8 bits\n(C) 10 bits\n(D) 12 bits",
                "style": "MCQ", "ans": "A"
            },
            {
                "text": "Which cache write policy guarantees that the main memory is updated simultaneously with cache updates?\n(A) Write-through\n(B) Write-back\n(C) No-write-allocate\n(D) Write-around",
                "style": "MCQ", "ans": "A"
            }
        ],
        "Instruction Pipelining & Hazards": [
            {
                "text": "Which of the following techniques is commonly used to resolve Data Hazards in instruction pipelining?\n(A) Operand Forwarding / Bypassing\n(B) Branch Prediction\n(C) Dynamic Loop Unrolling\n(D) Out-of-order execution",
                "style": "MCQ", "ans": "A"
            },
            {
                "text": "A 5-stage pipeline has stage delays of 10ns, 12ns, 15ns, 11ns, and 10ns. If the pipeline register delay is 1ns, what is the maximum clock frequency?\n(A) 62.5 MHz\n(B) 83.3 MHz\n(C) 100 MHz\n(D) 50 MHz",
                "style": "MCQ", "ans": "A"
            }
        ],
        "Operating System": [
            {
                "text": "Which page replacement algorithm suffers from Belady's Anomaly?\n(A) FIFO\n(B) LRU\n(C) Optimal\n(D) LFU",
                "style": "MCQ", "ans": "A"
            },
            {
                "text": "Which of the following is NOT a necessary condition for a deadlock to occur?\n(A) Preemption\n(B) Mutual exclusion\n(C) Hold and wait\n(D) Circular wait",
                "style": "MCQ", "ans": "A"
            },
            {
                "text": "The primary purpose of a Translation Lookaside Buffer (TLB) is to:\n(A) Speed up virtual-to-physical address translation\n(B) Cache primary database storage blocks\n(C) Manage thread context transitions\n(D) Optimize disk track latency schedules",
                "style": "MCQ", "ans": "A"
            }
        ],
        "Computer Networks": [
            {
                "text": "In the IPv4 addressing scheme, which of the following is a valid private IP address range?\n(A) 192.168.0.0 to 192.168.255.255\n(B) 172.16.0.0 to 172.32.255.255\n(C) 10.0.0.0 to 10.255.255.0\n(D) 127.0.0.0 to 127.255.255.255",
                "style": "MCQ", "ans": "A"
            },
            {
                "text": "What is the primary function of the Address Resolution Protocol (ARP)?\n(A) Resolve IP address to MAC hardware address\n(B) Resolve domain names to IP addresses\n(C) Route packets across internal subnets\n(D) Establish secure handshake sessions",
                "style": "MCQ", "ans": "A"
            },
            {
                "text": "Which TCP/IP transport layer protocol provides connection-oriented, reliable, and byte-stream flow control?\n(A) TCP\n(B) UDP\n(C) IP\n(D) ICMP",
                "style": "MCQ", "ans": "A"
            }
        ],
        "Databases": [
            {
                "text": "Which normal form guarantees that there are no multi-valued dependencies in a relation schema?\n(A) 4NF\n(B) 3NF\n(C) BCNF\n(D) 2NF",
                "style": "MCQ", "ans": "A"
            },
            {
                "text": "In a relational algebra, which operator is used to select specific columns from a relation?\n(A) Projection (π)\n(B) Selection (σ)\n(C) Join (⋈)\n(D) Cartesian Product (×)",
                "style": "MCQ", "ans": "A"
            },
            {
                "text": "The ACID properties of databases stand for:\n(A) Atomicity, Consistency, Isolation, Durability\n(B) Accuracy, Consistency, Integration, Duplication\n(C) Access, Concurrency, Isolation, Deletion\n(D) Availability, Convergence, Indexing, Delivery",
                "style": "MCQ", "ans": "A"
            }
        ]
    }

    # Fallback premium generic questions by parent subject area
    fallbacks = {
        "Discrete Mathematics": [
            {"text": "Which of the following relations on set A is always equivalence relation?\n(A) Identity relation\n(B) Empty relation\n(C) Asymmetric relation\n(D) Irreflexive relation", "style": "MCQ", "ans": "A"},
            {"text": "A complete graph K_n has V vertices. What is its chromatic number if V is odd?\n(A) V\n(B) V-1\n(C) 2\n(D) (V+1)/2", "style": "MCQ", "ans": "A"}
        ],
        "Engineering Mathematics": [
            {"text": "Let X be a continuous random variable. The area under its probability density function (PDF) must equal:\n(A) 1.0\n(B) 0.5\n(C) Infinity\n(D) The mean value", "style": "MCQ", "ans": "A"}
        ],
        "General Aptitude": [
            {"text": "Find the missing sequence number: 2, 6, 12, 20, 30, ?\n(A) 42\n(B) 40\n(C) 36\n(D) 45", "style": "MCQ", "ans": "A"},
            {"text": "He was so ________ that everyone in the office respected his principles.\n(A) conscientious\n(B) conscious\n(C) consensus\n(D) contagious", "style": "MCQ", "ans": "A"}
        ]
    }

    # Fetch all synthetic questions
    cursor.execute("""
        SELECT q.id, t.name, (SELECT name FROM topics WHERE id=t.parent_topic_id) as parent_name, q.question_style, q.correct_answer
        FROM questions q
        JOIN topics t ON q.topic_id = t.id
        WHERE q.question_text LIKE '%What is the core theorem%'
           OR q.question_text LIKE '%What is the correct answer%'
           OR q.question_text LIKE '%Standard option A%'
    """)
    synthetic_qs = cursor.fetchall()
    print(f"Found {len(synthetic_qs)} synthetic placeholder questions to diversify.")

    used_counters = {}

    for idx, (q_id, t_name, p_name, style, old_ans) in enumerate(synthetic_qs):
        # Determine pool of questions to pull from
        pool = []
        if t_name in templates:
            pool = templates[t_name]
        elif p_name in fallbacks:
            pool = fallbacks[p_name]
        else:
            # Absolute default fallback based on topic name
            pool = [
                {
                    "text": f"Which of the following represents a primary property or core concept associated with {t_name}?\n(A) Ideal mathematical invariant\n(B) Complementary structural parameter\n(C) Linear recurrence bound\n(D) Random simulation threshold",
                    "style": "MCQ", "ans": "A"
                },
                {
                    "text": f"What is the standard time complexity or structural relation for {t_name} in optimal cases?\n(A) O(1) or constant bounds\n(B) O(N log N) sorting bounds\n(C) O(N²) quadratic scaling\n(D) O(2^N) exponential tracking",
                    "style": "MCQ", "ans": "B"
                }
            ]

        # Cycle through templates to avoid exact repeats
        counter_key = f"{t_name}_{p_name}"
        index = used_counters.get(counter_key, 0)
        selected_q = pool[index % len(pool)]
        used_counters[counter_key] = index + 1

        # Patch this question!
        cursor.execute("""
            UPDATE questions
            SET question_text = ?, correct_answer = ?, question_style = ?
            WHERE id = ?
        """, (selected_q["text"], selected_q["ans"], selected_q["style"], q_id))

    conn.commit()
    print(f"Successfully diversified {len(synthetic_qs)} placeholder questions with rich premium content!")
    conn.close()

if __name__ == '__main__':
    patch_db_fully()
