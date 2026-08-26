import numpy as np
from sentence_transformers import SentenceTransformer
import clustering
from datetime import datetime

# We use the EXACT SAME MODEL the student app uses in-browser
model = SentenceTransformer("all-MiniLM-L6-v2")

def test_clustering():
    # Synthetic doubts mimicking classroom noise
    texts = [
        # Concept A: Stack overflow / recursion
        "what is a stack overflow",
        "why does recursion crash",
        "confused about stack overflow error",
        "my recursive function keeps looping and crashing",
        
        # Concept B: Pass by reference vs value
        "what's the difference between pass by value and reference",
        "how does pass by reference work in python",
        "does python copy the object or just the reference",
        
        # Concept C: Interfaces
        "I don't understand what an interface is used for",
        "why do we need interfaces if we have abstract classes",
        
        # Noise (Singletons)
        "what time is the assignment due",
        "can you explain big O notation again"
    ]
    
    print("Generating embeddings...")
    embeddings = model.encode(texts)
    
    doubts = []
    base_time = datetime.utcnow()
    for i, (txt, emb) in enumerate(zip(texts, embeddings)):
        doubts.append({
            'id': i,
            'text': txt,
            'embedding': emb.tolist(),
            'timestamp': base_time # all same time for test
        })
        
    print("Clustering...")
    clusters = clustering.compute_clusters(doubts)
    
    print("\n--- RESULTS ---")
    for c in clusters:
        print(f"\nCluster ID: {c['id']} | Score: {c['score']} | Count: {c['count']}")
        print(f"Representative: \"{c['representative_text']}\"")
        
        # Find which exact texts fell in here
        cluster_texts = []
        for d in doubts:
            # We can recompute or just check proximity to the medoid
            pass
            
    # Verify we got roughly 5 clusters (A, B, C, Noise1, Noise2)
    print(f"\nTotal clusters formed: {len(clusters)}")

if __name__ == "__main__":
    test_clustering()
