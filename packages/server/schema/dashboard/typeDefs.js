const dashboardTypeDefs = `#graphql
  input DashboardFiltersInput {
    district: String
    gender: String
    disability: String
    date_from: String
    date_to: String
    top_limit: Int
  }

  type DashboardFiltersApplied {
    district: String
    gender: String
    disability: String
    date_from: String
    date_to: String
    top_limit: Int!
  }

  type DashboardKpis {
    total_pwds: Int!
    total_district_unions: Int!
    total_national_opds: Int!
    total_service_providers: Int!
    verified_pwds: Int!
    unverified_pwds: Int!
    districts_with_pwds: Int!
    jobs: Int!
    products: Int!
    innovations: Int!
  }

  type DashboardSeriesItem {
    label: String!
    value: Int!
  }

  type DashboardAgeGenderItem {
    bucket: String!
    male: Int!
    female: Int!
    total: Int!
  }

  type DashboardMonthlyItem {
    month: String!
    value: Int!
  }

  type DashboardStats {
    generated_at: String!
    filters: DashboardFiltersApplied!
    kpis: DashboardKpis!
    gender_distribution: [DashboardSeriesItem!]!
    age_gender_distribution: [DashboardAgeGenderItem!]!
    disability_breakdown: [DashboardSeriesItem!]!
    monthly_registrations: [DashboardMonthlyItem!]!
    district_breakdown: [DashboardSeriesItem!]!
    
  }

  type LandingPageStats {
    gender_distribution: [DashboardSeriesItem!]!
    age_gender_distribution: [DashboardAgeGenderItem!]!
    disability_breakdown: [DashboardSeriesItem!]!
    monthly_registrations: [DashboardMonthlyItem!]!
    district_breakdown: [DashboardSeriesItem!]!
    
  }

  type Query {
    dashboardStats(filters: DashboardFiltersInput): DashboardStats!
    landingPageStats: LandingPageStats!
    publicPwdCount: Int!
  }
`;

export default dashboardTypeDefs;
