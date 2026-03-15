const { createClient } = require("@supabase/supabase-js");

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY,
);

async function classifyAndRouteRequest(requestData) {
  const { doc_type_id, student_id, request_details } = requestData;

  try {
    const { data: docType, error: docError } = await supabase
      .from("document_types")
      .select("*")
      .eq("id", doc_type_id)
      .single();

    if (docError) throw docError;

    const { data: student, error: studentError } = await supabase
      .from("profiles")
      .select("course_year, student_number")
      .eq("id", student_id)
      .single();

    if (studentError) throw studentError;

    const classification = await performIntelligentClassification({
      docType,
      student,
      requestDetails: request_details,
    });

    const routing = await determineOptimalRouting(classification, docType);

    await logAIDecision({
      student_id,
      doc_type_id,
      classification,
      routing,
      timestamp: new Date().toISOString(),
    });

    return {
      success: true,
      classification,
      routing,
      aiProcessed: true,
    };
  } catch (error) {
    console.error("AI Classification Error:", error);
    return {
      success: false,
      error: error.message,
      fallbackToManual: true,
    };
  }
}

async function performIntelligentClassification(context) {
  const { docType, student, requestDetails } = context;

  const keywords = extractKeywords(docType.name, requestDetails);

  const category = categorizeRequest(docType.name);

  const priorityScore = calculatePriorityScore({
    docType,
    student,
    keywords,
  });

  const urgency = determineUrgency(priorityScore);

  return {
    category,
    priorityScore,
    urgency,
    keywords,
    confidence: 0.95,
    processingMethod: "rule-based",
  };
}

async function determineOptimalRouting(classification, docType) {
  const requiredStages = docType.required_stages || [];

  const initialStage = requiredStages[0] || "registrar";

  const assignedRole = `${initialStage}_admin`;

  const estimatedTime = estimateProcessingTime(
    classification,
    requiredStages.length,
  );

  const escalationThreshold = Math.ceil(estimatedTime * 1.5);

  return {
    initialStage,
    assignedRole,
    requiredStages,
    totalStages: requiredStages.length,
    estimatedProcessingTime: estimatedTime,
    escalationThreshold,
    routingStrategy: "sequential",
    autoAssigned: true,
  };
}

function extractKeywords(docTypeName, details) {
  const text = `${docTypeName} ${details || ""}`.toLowerCase();
  const keywords = [];

  const patterns = {
    urgent: ["urgent", "asap", "emergency", "immediate"],
    academic: ["transcript", "grades", "diploma", "certificate"],
    financial: ["payment", "fee", "tuition", "scholarship"],
    clearance: ["clearance", "exit", "graduation", "completion"],
  };

  for (const [category, words] of Object.entries(patterns)) {
    if (words.some((word) => text.includes(word))) {
      keywords.push(category);
    }
  }

  return keywords;
}

function categorizeRequest(docTypeName) {
  const name = docTypeName.toLowerCase();

  if (name.includes("clearance")) return "clearance";
  if (name.includes("transcript") || name.includes("grades"))
    return "academic_records";
  if (name.includes("certificate") || name.includes("diploma"))
    return "certification";
  if (name.includes("id") || name.includes("card")) return "identification";

  return "general";
}

function calculatePriorityScore(context) {
  let score = 50;

  if (context.keywords.includes("urgent")) score += 30;
  if (context.keywords.includes("clearance")) score += 20;
  if (context.keywords.includes("academic")) score += 10;

  const stageCount = context.docType.required_stages?.length || 1;
  score += Math.min(stageCount * 5, 20);

  return Math.min(Math.max(score, 0), 100);
}

function determineUrgency(priorityScore) {
  if (priorityScore >= 80) return "critical";
  if (priorityScore >= 60) return "high";
  if (priorityScore >= 40) return "medium";
  return "low";
}

function estimateProcessingTime(classification, stageCount) {
  const baseTime = 24;
  const timePerStage = 12;

  let estimatedTime = baseTime + stageCount * timePerStage;

  if (classification.urgency === "critical") estimatedTime *= 0.5;
  else if (classification.urgency === "high") estimatedTime *= 0.75;

  return Math.ceil(estimatedTime);
}

async function logAIDecision(decisionData) {
  try {
    const { error } = await supabase.from("ai_routing_logs").insert({
      student_id: decisionData.student_id,
      doc_type_id: decisionData.doc_type_id,
      classification: decisionData.classification,
      routing: decisionData.routing,
      timestamp: decisionData.timestamp,
    });
    if (error) {
      // Table may not exist yet — see migrations/add_ai_routing_logs.sql
      console.warn("AI routing log skipped (table may not exist):", error.message);
    }
  } catch (error) {
    console.warn("AI routing log skipped:", error.message);
  }
}

async function getRoutingStatistics(timeRange = "7d") {
  try {
    const { data, error } = await supabase
      .from("ai_routing_logs")
      .select("*")
      .gte("timestamp", getTimeRangeStart(timeRange));

    if (error) throw error;

    return {
      totalProcessed: data.length,
      averageConfidence: calculateAverageConfidence(data),
      categoryDistribution: getCategoryDistribution(data),
      urgencyDistribution: getUrgencyDistribution(data),
    };
  } catch (error) {
    console.warn("Routing statistics unavailable (table may not exist):", error.message);
    return null;
  }
}

function getTimeRangeStart(range) {
  const now = new Date();
  const days = parseInt(range) || 7;
  now.setDate(now.getDate() - days);
  return now.toISOString();
}

function calculateAverageConfidence(logs) {
  if (!logs.length) return 0;
  const sum = logs.reduce(
    (acc, log) => acc + (log.classification?.confidence || 0),
    0,
  );
  return (sum / logs.length).toFixed(2);
}

function getCategoryDistribution(logs) {
  const distribution = {};
  logs.forEach((log) => {
    const category = log.classification?.category || "unknown";
    distribution[category] = (distribution[category] || 0) + 1;
  });
  return distribution;
}

function getUrgencyDistribution(logs) {
  const distribution = {};
  logs.forEach((log) => {
    const urgency = log.classification?.urgency || "unknown";
    distribution[urgency] = (distribution[urgency] || 0) + 1;
  });
  return distribution;
}

module.exports = {
  classifyAndRouteRequest,
  getRoutingStatistics,
};
