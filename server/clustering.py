import numpy as np
from sklearn.cluster import AgglomerativeClustering
from sklearn.metrics.pairwise import cosine_distances
from datetime import datetime, timedelta

# Distance threshold: Max cosine distance between two vectors to be considered in the same cluster.
# Needs empirical tuning with real Whisper-transcribed student doubts.
# 0.65 is a good starting point for all-MiniLM-L6-v2 (where 0.0 is identical, 1.0 is orthogonal).
DISTANCE_THRESHOLD = 0.65

def compute_clusters(doubts: list[dict]) -> list[dict]:
    """
    doubts: list of dicts with keys: 'id', 'text', 'embedding', 'timestamp'
    Returns a list of cluster dicts.
    """
    if not doubts:
        return []

    # If only 1 doubt, it's its own cluster
    if len(doubts) == 1:
        d = doubts[0]
        return [format_cluster(0, [d])]

    embeddings = np.array([d['embedding'] for d in doubts])
    
    # AgglomerativeClustering with 'cosine' affinity expects metric='cosine', linkage='average' (or complete/single).
    # 'average' is generally robust for topic clustering.
    clustering = AgglomerativeClustering(
        n_clusters=None,
        distance_threshold=DISTANCE_THRESHOLD,
        metric='cosine',
        linkage='average'
    )
    
    labels = clustering.fit_predict(embeddings)
    
    # Group doubts by label
    clusters_map = {}
    for label, d in zip(labels, doubts):
        if label not in clusters_map:
            clusters_map[label] = []
        clusters_map[label].append(d)
        
    result = []
    for label, cluster_doubts in clusters_map.items():
        result.append(format_cluster(int(label), cluster_doubts))
        
    # Sort by score descending
    result.sort(key=lambda c: c['score'], reverse=True)
    return result

def format_cluster(cluster_id: int, cluster_doubts: list[dict]) -> dict:
    count = len(cluster_doubts)
    
    # Representative Text: Find Medoid (the doubt closest to the center of the cluster)
    embeddings = np.array([d['embedding'] for d in cluster_doubts])
    if count == 1:
        medoid_idx = 0
    else:
        # Calculate pairwise cosine distances within the cluster
        dist_matrix = cosine_distances(embeddings)
        # Find the index with the minimum average distance to all other points in this cluster
        avg_distances = dist_matrix.mean(axis=1)
        medoid_idx = int(np.argmin(avg_distances))
        
    representative_text = cluster_doubts[medoid_idx]['text']
    
    # Sort by timestamp
    cluster_doubts.sort(key=lambda d: d['timestamp'])
    
    spike_history = []
    doubts_in_last_60s = 0
    now = datetime.utcnow()
    
    for d in cluster_doubts:
        ts = d['timestamp']
        spike_history.append({'timestamp': ts.isoformat(), 'count': 1}) # Can be aggregated by minute for dashboard chart
        if now - ts <= timedelta(seconds=60):
            doubts_in_last_60s += 1
            
    # Score function: total count + weight * recent_velocity
    # Explanation: Large clusters rank high naturally. Clusters that just got an influx of doubts get a temporary visibility boost.
    score = count + (1.5 * doubts_in_last_60s)
    
    last_updated_at = cluster_doubts[-1]['timestamp'].isoformat()
    
    return {
        'id': cluster_id,
        'representative_text': representative_text,
        'count': count,
        'score': round(score, 2),
        'spike_history': spike_history,
        'last_updated_at': last_updated_at
    }
