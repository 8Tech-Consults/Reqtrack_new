import { db } from "../../config/config.js";
import hasPermission from "../../helpers/hasPermission.js";

const AGE_BUCKETS = [
  { label: "0 - 5", min: 0, max: 5 },
  { label: "6 - 12", min: 6, max: 12 },
  { label: "13 - 18", min: 13, max: 18 },
  { label: "19 - 30", min: 19, max: 30 },
  { label: "31 - 45", min: 31, max: 45 },
  { label: "46 - 65", min: 46, max: 65 },
  { label: "65+", min: 66, max: Number.MAX_SAFE_INTEGER },
];

const normalizeText = (value) => String(value ?? "").trim();

const normalizeGenderFilter = (value) => {
  const normalized = normalizeText(value).toLowerCase();
  if (!normalized || normalized === "all") return null;
  if (normalized === "m" || normalized === "male") return "male";
  if (normalized === "f" || normalized === "female") return "female";
  return null;
};

const normalizeDateInput = (value) => {
  const raw = normalizeText(value);
  if (!raw) return null;
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return null;
  const year = parsed.getFullYear();
  const month = String(parsed.getMonth() + 1).padStart(2, "0");
  const day = String(parsed.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const parseDisabilities = (value) => {
  if (!value) return [];
  if (Array.isArray(value)) return value;

  const raw = normalizeText(value);
  if (!raw) return [];

  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed.map((item) => normalizeText(item)).filter(Boolean);
    }
  } catch (error) {
    // fallback to comma-separated parsing
  }

  return raw
    .split(",")
    .map((item) => normalizeText(item))
    .filter(Boolean);
};

const normalizeGenderValue = (value) => {
  const normalized = normalizeText(value).toLowerCase();
  if (normalized === "male" || normalized === "m") return "male";
  if (normalized === "female" || normalized === "f") return "female";
  return "other";
};

const resolveAgeBucket = (age) => {
  const numeric = Number(age);
  if (!Number.isFinite(numeric) || numeric < 0) return null;
  return AGE_BUCKETS.find((bucket) => numeric >= bucket.min && numeric <= bucket.max) || null;
};

const formatMonthLabel = (monthKey) => {
  const [year, month] = String(monthKey).split("-");
  if (!year || !month) return monthKey;
  const date = new Date(Number(year), Number(month) - 1, 1);
  return date.toLocaleString("en-US", { month: "short", year: "numeric" });
};

const buildMonthKeys = (startDate, endDate, maxMonths = 24) => {
  const cursor = new Date(startDate.getFullYear(), startDate.getMonth(), 1);
  const end = new Date(endDate.getFullYear(), endDate.getMonth(), 1);
  const keys = [];

  while (cursor <= end && keys.length < maxMonths) {
    const year = cursor.getFullYear();
    const month = String(cursor.getMonth() + 1).padStart(2, "0");
    keys.push(`${year}-${month}`);
    cursor.setMonth(cursor.getMonth() + 1);
  }

  return keys;
};

const resolveMonthRange = ({ dateFrom, dateTo }) => {
  const now = new Date();
  const resolvedEnd = dateTo ? new Date(dateTo) : now;
  if (Number.isNaN(resolvedEnd.getTime())) {
    const fallbackStart = new Date(now.getFullYear(), now.getMonth() - 11, 1);
    return { start: fallbackStart, end: now };
  }

  let resolvedStart;
  if (dateFrom) {
    const parsedStart = new Date(dateFrom);
    resolvedStart = Number.isNaN(parsedStart.getTime())
      ? new Date(resolvedEnd.getFullYear(), resolvedEnd.getMonth() - 11, 1)
      : parsedStart;
  } else {
    resolvedStart = new Date(resolvedEnd.getFullYear(), resolvedEnd.getMonth() - 11, 1);
  }

  const start = new Date(resolvedStart.getFullYear(), resolvedStart.getMonth(), 1);
  const end = new Date(resolvedEnd.getFullYear(), resolvedEnd.getMonth(), 1);

  if (start > end) {
    return { start: end, end: start };
  }

  return { start, end };
};

const buildPwdWhere = ({
  district,
  gender,
  disability,
  dateFrom,
  dateTo,
  userId,
  includeDate = true,
}) => {
  const clauses = ["pwds.deleted = 0"];
  const params = [];

  if (district) {
    clauses.push("LOWER(TRIM(pwds.district_of_origin)) = ?");
    params.push(district.toLowerCase());
  }

  if (gender === "male") {
    clauses.push("LOWER(TRIM(pwds.gender)) IN (?, ?)");
    params.push("male", "m");
  } else if (gender === "female") {
    clauses.push("LOWER(TRIM(pwds.gender)) IN (?, ?)");
    params.push("female", "f");
  }

  if (disability) {
    clauses.push("LOWER(COALESCE(pwds.disabilities, '')) LIKE ?");
    params.push(`%${disability.toLowerCase()}%`);
  }

  if(userId) {
    clauses.push("pwds.created_by_user_id = ?");
    params.push(userId);
  }

  if (includeDate && dateFrom) {
    clauses.push("DATE(pwds.created_at) >= ?");
    params.push(dateFrom);
  }

  if (includeDate && dateTo) {
    clauses.push("DATE(pwds.created_at) <= ?");
    params.push(dateTo);
  }

  return {
    whereClause: `WHERE ${clauses.join(" AND ")}`,
    params,
  };
};

const buildOrganisationWhere = ({ relationshipType, district, dateFrom, dateTo }) => {
  const clauses = [
    "COALESCE(o.deleted, 0) = 0",
    "LOWER(TRIM(COALESCE(o.relationship_type, ''))) = ?",
  ];
  const params = [relationshipType];

  if (district) {
    clauses.push(
      "(LOWER(TRIM(COALESCE(d.name, ''))) = ? OR EXISTS (" +
        "SELECT 1 FROM district_organisation do_map " +
        "LEFT JOIN districts d2 ON d2.id = do_map.district_id " +
        "WHERE do_map.organisation_id = o.id AND LOWER(TRIM(COALESCE(d2.name, ''))) = ?" +
      "))"
    );
    params.push(district.toLowerCase(), district.toLowerCase());
  }

  if (dateFrom) {
    clauses.push("DATE(o.created_at) >= ?");
    params.push(dateFrom);
  }

  if (dateTo) {
    clauses.push("DATE(o.created_at) <= ?");
    params.push(dateTo);
  }

  return {
    whereClause: `WHERE ${clauses.join(" AND ")}`,
    params,
  };
};

const buildServiceProvidersWhere = ({ district, dateFrom, dateTo }) => {
  const clauses = ["1 = 1"];
  const params = [];

  if (district) {
    clauses.push(
      "(" +
        "EXISTS (" +
          "SELECT 1 FROM district_service_provider dsp " +
          "LEFT JOIN districts d ON d.id = dsp.district_id " +
          "WHERE dsp.service_provider_id = sp.id AND LOWER(TRIM(COALESCE(d.name, ''))) = ?" +
        ") " +
        "OR LOWER(COALESCE(sp.districts_of_operation, '')) LIKE ?" +
      ")"
    );
    params.push(district.toLowerCase(), `%${district.toLowerCase()}%`);
  }

  if (dateFrom) {
    clauses.push("DATE(sp.created_at) >= ?");
    params.push(dateFrom);
  }

  if (dateTo) {
    clauses.push("DATE(sp.created_at) <= ?");
    params.push(dateTo);
  }

  return {
    whereClause: `WHERE ${clauses.join(" AND ")}`,
    params,
  };
};

const dashboardResolvers = {
  Query: {
    publicPwdCount: async () => {
      const [rows] = await db.execute(
        "SELECT COUNT(*) AS total FROM pwds WHERE deleted = 0"
      );
      return Number(rows?.[0]?.total || 0);
    },
    dashboardStats: async (_parent, { filters = {} }, context) => {
      const userPermissions = context?.req?.user?.permissions;
      const canViewOwnPwds = hasPermission(userPermissions, "can_view_own_pwds");
      const actorUserId = canViewOwnPwds ? context?.req?.user?.id : null;

      const district = normalizeText(filters?.district) || null;
      const gender = normalizeGenderFilter(filters?.gender);
      const disability = normalizeText(filters?.disability) || null;
      const dateFrom = normalizeDateInput(filters?.date_from);
      const dateTo = normalizeDateInput(filters?.date_to);
      const topLimitRaw = Number(filters?.top_limit);
      const topLimit = Number.isFinite(topLimitRaw)
        ? Math.min(Math.max(topLimitRaw, 3), 15)
        : 5;

      const pwdWhere = buildPwdWhere({
        district,
        gender,
        disability,
        dateFrom,
        dateTo,
        userId: actorUserId,
        includeDate: true,
      });

      const pwdBaseWhere = buildPwdWhere({
        district,
        gender,
        disability,
        dateFrom,
        dateTo,
        userId: actorUserId,
        includeDate: false,
      });

      const orgDuWhere = buildOrganisationWhere({
        relationshipType: "du",
        district,
        dateFrom,
        dateTo,
      });
      const orgOpdWhere = buildOrganisationWhere({
        relationshipType: "opd",
        district,
        dateFrom,
        dateTo,
      });
      const serviceProviderWhere = buildServiceProvidersWhere({
        district,
        dateFrom,
        dateTo,
      });

      const [
        [pwdTotalRows],
        [verifiedRows],
        [districtCoverageRows],
        [duRows],
        [opdRows],
        [serviceProviderRows],
        [jobsRows],
        [productsRows],
        [innovationsRows],
        [genderRows],
        [ageRows],
        [disabilityRows],
        [districtRows],
      ] = await Promise.all([
        db.execute(
          `SELECT COUNT(*) AS total FROM pwds ${pwdWhere.whereClause}`,
          pwdWhere.params
        ),
        db.execute(
          `SELECT
            SUM(CASE WHEN pwds.verified = 1 THEN 1 ELSE 0 END) AS verified_total,
            SUM(CASE WHEN COALESCE(pwds.verified, 0) = 0 THEN 1 ELSE 0 END) AS unverified_total
          FROM pwds ${pwdWhere.whereClause}`,
          pwdWhere.params
        ),
        db.execute(
          `SELECT COUNT(DISTINCT LOWER(TRIM(COALESCE(pwds.district_of_origin, '')))) AS total
          FROM pwds ${pwdWhere.whereClause}`,
          pwdWhere.params
        ),
        db.execute(
          `SELECT COUNT(*) AS total
           FROM organisations o
           LEFT JOIN districts d ON d.id = o.district_id
           ${orgDuWhere.whereClause}`,
          orgDuWhere.params
        ),
        db.execute(
          `SELECT COUNT(*) AS total
           FROM organisations o
           LEFT JOIN districts d ON d.id = o.district_id
           ${orgOpdWhere.whereClause}`,
          orgOpdWhere.params
        ),
        db.execute(
          `SELECT COUNT(*) AS total
           FROM service_providers sp
           ${serviceProviderWhere.whereClause}`,
          serviceProviderWhere.params
        ),
        db.execute(
          `SELECT COUNT(*) AS total FROM jobs j WHERE j.status = 'Active'
          `,
        ),
        db.execute(
          `SELECT COUNT(*) AS total FROM products p
          `,
        ),
        db.execute(
          `SELECT COUNT(*) AS total FROM innovations i
          `,
        ),
        db.execute(
          `SELECT pwds.gender, COUNT(*) AS total
           FROM pwds
           ${pwdWhere.whereClause}
           GROUP BY pwds.gender`,
          pwdWhere.params
        ),
        db.execute(
          `SELECT
             TIMESTAMPDIFF(YEAR, pwds.date_of_birth, CURDATE()) AS age,
             pwds.gender
           FROM pwds
           ${pwdWhere.whereClause}`,
          pwdWhere.params
        ),
        db.execute(
          `SELECT pwds.disabilities
           FROM pwds
           ${pwdWhere.whereClause}`,
          pwdWhere.params
        ),
        db.execute(
          `SELECT
            TRIM(COALESCE(pwds.district_of_origin, 'Unknown')) AS label,
            COUNT(*) AS value
           FROM pwds
           ${pwdWhere.whereClause}
           GROUP BY TRIM(COALESCE(pwds.district_of_origin, 'Unknown'))
           ORDER BY value DESC
           LIMIT ?`,
          [...pwdWhere.params, topLimit]
        ),
      ]);

      const genderAccumulator = { male: 0, female: 0, other: 0 };
      genderRows.forEach((row) => {
        const group = normalizeGenderValue(row?.gender);
        const count = Number(row?.total || 0);
        genderAccumulator[group] += count;
      });

      const ageDistributionMap = new Map(
        AGE_BUCKETS.map((bucket) => [
          bucket.label,
          { bucket: bucket.label, male: 0, female: 0, total: 0 },
        ])
      );
      ageRows.forEach((row) => {
        const bucket = resolveAgeBucket(row?.age);
        if (!bucket) return;
        const item = ageDistributionMap.get(bucket.label);
        if (!item) return;

        const genderGroup = normalizeGenderValue(row?.gender);
        item.total += 1;
        if (genderGroup === "male") item.male += 1;
        if (genderGroup === "female") item.female += 1;
      });

      const disabilityMap = new Map();
      disabilityRows.forEach((row) => {
        const list = parseDisabilities(row?.disabilities);
        list.forEach((entry) => {
          const label = normalizeText(entry);
          if (!label) return;
          const key = label.toLowerCase();
          disabilityMap.set(key, {
            label,
            value: Number(disabilityMap.get(key)?.value || 0) + 1,
          });
        });
      });

      const disabilityBreakdown = Array.from(disabilityMap.values())
        .sort((a, b) => b.value - a.value)
        .slice(0, topLimit);

      const monthlyRange = resolveMonthRange({ dateFrom, dateTo });
      const monthlyKeys = buildMonthKeys(monthlyRange.start, monthlyRange.end);
      const fallbackNow = normalizeDateInput(new Date()) || new Date().toISOString().slice(0, 10);
      const monthlyStart = monthlyKeys.length ? `${monthlyKeys[0]}-01` : fallbackNow;
      const monthlyEnd = dateTo || fallbackNow;

      const [monthlyRows] = await db.execute(
        `SELECT
          DATE_FORMAT(pwds.created_at, '%Y-%m') AS month_key,
          COUNT(*) AS total
        FROM pwds
        ${pwdBaseWhere.whereClause}
        AND DATE(pwds.created_at) >= ?
        AND DATE(pwds.created_at) <= ?
        GROUP BY DATE_FORMAT(pwds.created_at, '%Y-%m')
        ORDER BY month_key ASC`,
        [...pwdBaseWhere.params, monthlyStart, monthlyEnd]
      );

      const monthlyMap = new Map(
        monthlyRows.map((row) => [normalizeText(row.month_key), Number(row.total || 0)])
      );
      const monthlyRegistrations = monthlyKeys.map((key) => ({
        month: formatMonthLabel(key),
        value: monthlyMap.get(key) || 0,
      }));

      return {
        generated_at: new Date().toISOString(),
        filters: {
          district,
          gender,
          disability,
          date_from: dateFrom,
          date_to: dateTo,
          top_limit: topLimit,
        },
        kpis: {
          total_pwds: Number(pwdTotalRows?.[0]?.total || 0),
          total_district_unions: Number(duRows?.[0]?.total || 0),
          total_national_opds: Number(opdRows?.[0]?.total || 0),
          total_service_providers: Number(serviceProviderRows?.[0]?.total || 0),
          verified_pwds: Number(verifiedRows?.[0]?.verified_total || 0),
          unverified_pwds: Number(verifiedRows?.[0]?.unverified_total || 0),
          districts_with_pwds: Number(districtCoverageRows?.[0]?.total || 0),
          jobs: Number(jobsRows?.[0]?.total || 0),
          products: Number(productsRows?.[0]?.total || 0),
          innovations: Number(innovationsRows?.[0]?.total || 0),
        },
        gender_distribution: [
          { label: "Female", value: genderAccumulator.female },
          { label: "Male", value: genderAccumulator.male },
          { label: "Other", value: genderAccumulator.other },
        ],
        age_gender_distribution: AGE_BUCKETS.map((bucket) => {
          const item = ageDistributionMap.get(bucket.label);
          return {
            bucket: bucket.label,
            male: item?.male || 0,
            female: item?.female || 0,
            total: item?.total || 0,
          };
        }),
        disability_breakdown: disabilityBreakdown,
        monthly_registrations: monthlyRegistrations,
        district_breakdown: districtRows.map((row) => ({
          label: normalizeText(row.label) || "Unknown",
          value: Number(row.value || 0),
        })),

      };
    },

      landingPageStats: async (_parent, { filters = {} }, context) => {
      const userPermissions = context?.req?.user?.permissions;
      const canViewOwnPwds = hasPermission(userPermissions, "can_view_own_pwds");
      const actorUserId = canViewOwnPwds ? context?.req?.user?.id : null;

      const district = normalizeText(filters?.district) || null;
      const gender = normalizeGenderFilter(filters?.gender);
      const disability = normalizeText(filters?.disability) || null;
      const dateFrom = normalizeDateInput(filters?.date_from);
      const dateTo = normalizeDateInput(filters?.date_to);
      const topLimitRaw = Number(filters?.top_limit);
      const topLimit = Number.isFinite(topLimitRaw)
        ? Math.min(Math.max(topLimitRaw, 3), 15)
        : 5;

      const pwdWhere = buildPwdWhere({
        district,
        gender,
        disability,
        dateFrom,
        dateTo,
        userId: actorUserId,
        includeDate: true,
      });

      const pwdBaseWhere = buildPwdWhere({
        district,
        gender,
        disability,
        dateFrom,
        dateTo,
        userId: actorUserId,
        includeDate: false,
      });

      const orgDuWhere = buildOrganisationWhere({
        relationshipType: "du",
        district,
        dateFrom,
        dateTo,
      });
      const orgOpdWhere = buildOrganisationWhere({
        relationshipType: "opd",
        district,
        dateFrom,
        dateTo,
      });
      const serviceProviderWhere = buildServiceProvidersWhere({
        district,
        dateFrom,
        dateTo,
      });

      const [
        [pwdTotalRows],
        [verifiedRows],
        [districtCoverageRows],
        [duRows],
        [opdRows],
        [serviceProviderRows],
        [jobsRows],
        [productsRows],
        [genderRows],
        [ageRows],
        [disabilityRows],
        [districtRows],
      ] = await Promise.all([
        db.execute(
          `SELECT COUNT(*) AS total FROM pwds ${pwdWhere.whereClause}`,
          pwdWhere.params
        ),
        db.execute(
          `SELECT
            SUM(CASE WHEN pwds.verified = 1 THEN 1 ELSE 0 END) AS verified_total,
            SUM(CASE WHEN COALESCE(pwds.verified, 0) = 0 THEN 1 ELSE 0 END) AS unverified_total
          FROM pwds ${pwdWhere.whereClause}`,
          pwdWhere.params
        ),
        db.execute(
          `SELECT COUNT(DISTINCT LOWER(TRIM(COALESCE(pwds.district_of_origin, '')))) AS total
          FROM pwds ${pwdWhere.whereClause}`,
          pwdWhere.params
        ),
        db.execute(
          `SELECT COUNT(*) AS total
           FROM organisations o
           LEFT JOIN districts d ON d.id = o.district_id
           ${orgDuWhere.whereClause}`,
          orgDuWhere.params
        ),
        db.execute(
          `SELECT COUNT(*) AS total
           FROM organisations o
           LEFT JOIN districts d ON d.id = o.district_id
           ${orgOpdWhere.whereClause}`,
          orgOpdWhere.params
        ),
        db.execute(
          `SELECT COUNT(*) AS total
           FROM service_providers sp
           ${serviceProviderWhere.whereClause}`,
          serviceProviderWhere.params
        ),
        db.execute(
          `SELECT COUNT(*) AS total FROM jobs j WHERE j.status = 'Active'
          `,
        ),
        db.execute(
          `SELECT COUNT(*) AS total FROM products p
          `,
        ),
        db.execute(
          `SELECT pwds.gender, COUNT(*) AS total
           FROM pwds
           ${pwdWhere.whereClause}
           GROUP BY pwds.gender`,
          pwdWhere.params
        ),
        db.execute(
          `SELECT
             TIMESTAMPDIFF(YEAR, pwds.date_of_birth, CURDATE()) AS age,
             pwds.gender
           FROM pwds
           ${pwdWhere.whereClause}`,
          pwdWhere.params
        ),
        db.execute(
          `SELECT pwds.disabilities
           FROM pwds
           ${pwdWhere.whereClause}`,
          pwdWhere.params
        ),
        db.execute(
          `SELECT
            TRIM(COALESCE(pwds.district_of_origin, 'Unknown')) AS label,
            COUNT(*) AS value
           FROM pwds
           ${pwdWhere.whereClause}
           GROUP BY TRIM(COALESCE(pwds.district_of_origin, 'Unknown'))
           ORDER BY value DESC
           LIMIT ?`,
          [...pwdWhere.params, topLimit]
        ),
      ]);

      const genderAccumulator = { male: 0, female: 0, other: 0 };
      genderRows.forEach((row) => {
        const group = normalizeGenderValue(row?.gender);
        const count = Number(row?.total || 0);
        genderAccumulator[group] += count;
      });

      const ageDistributionMap = new Map(
        AGE_BUCKETS.map((bucket) => [
          bucket.label,
          { bucket: bucket.label, male: 0, female: 0, total: 0 },
        ])
      );
      ageRows.forEach((row) => {
        const bucket = resolveAgeBucket(row?.age);
        if (!bucket) return;
        const item = ageDistributionMap.get(bucket.label);
        if (!item) return;

        const genderGroup = normalizeGenderValue(row?.gender);
        item.total += 1;
        if (genderGroup === "male") item.male += 1;
        if (genderGroup === "female") item.female += 1;
      });

      const disabilityMap = new Map();
      disabilityRows.forEach((row) => {
        const list = parseDisabilities(row?.disabilities);
        list.forEach((entry) => {
          const label = normalizeText(entry);
          if (!label) return;
          const key = label.toLowerCase();
          disabilityMap.set(key, {
            label,
            value: Number(disabilityMap.get(key)?.value || 0) + 1,
          });
        });
      });

      const disabilityBreakdown = Array.from(disabilityMap.values())
        .sort((a, b) => b.value - a.value)
        .slice(0, topLimit);

      const monthlyRange = resolveMonthRange({ dateFrom, dateTo });
      const monthlyKeys = buildMonthKeys(monthlyRange.start, monthlyRange.end);
      const fallbackNow = normalizeDateInput(new Date()) || new Date().toISOString().slice(0, 10);
      const monthlyStart = monthlyKeys.length ? `${monthlyKeys[0]}-01` : fallbackNow;
      const monthlyEnd = dateTo || fallbackNow;

      const [monthlyRows] = await db.execute(
        `SELECT
          DATE_FORMAT(pwds.created_at, '%Y-%m') AS month_key,
          COUNT(*) AS total
        FROM pwds
        ${pwdBaseWhere.whereClause}
        AND DATE(pwds.created_at) >= ?
        AND DATE(pwds.created_at) <= ?
        GROUP BY DATE_FORMAT(pwds.created_at, '%Y-%m')
        ORDER BY month_key ASC`,
        [...pwdBaseWhere.params, monthlyStart, monthlyEnd]
      );

      const monthlyMap = new Map(
        monthlyRows.map((row) => [normalizeText(row.month_key), Number(row.total || 0)])
      );
      const monthlyRegistrations = monthlyKeys.map((key) => ({
        month: formatMonthLabel(key),
        value: monthlyMap.get(key) || 0,
      }));

      return {
        
        gender_distribution: [
          { label: "Female", value: genderAccumulator.female },
          { label: "Male", value: genderAccumulator.male },
          { label: "Other", value: genderAccumulator.other },
        ],
        age_gender_distribution: AGE_BUCKETS.map((bucket) => {
          const item = ageDistributionMap.get(bucket.label);
          return {
            bucket: bucket.label,
            male: item?.male || 0,
            female: item?.female || 0,
            total: item?.total || 0,
          };
        }),
        disability_breakdown: disabilityBreakdown,
        monthly_registrations: monthlyRegistrations,
        district_breakdown: districtRows.map((row) => ({
          label: normalizeText(row.label) || "Unknown",
          value: Number(row.value || 0),
        })),

      };
    },
  },
};

export default dashboardResolvers;
