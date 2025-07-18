import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  ActivityIndicator,
  Dimensions,
  ScrollView,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Svg, { 
  Path, 
  Circle, 
  G, 
  Text as SvgText, 
  Line, 
  Rect,
  Defs,
  LinearGradient,
  Stop
} from 'react-native-svg';
import * as d3 from 'd3';
import { statisticsService } from '../../../services/statisticsService';

const FLAVORWORLD_COLORS = {
  primary: '#F5A623',
  secondary: '#4ECDC4',
  accent: '#1F3A93',
  background: '#FFF8F0',
  white: '#FFFFFF',
  text: '#2C3E50',
  textLight: '#7F8C8D',
  border: '#E8E8E8',
  success: '#27AE60',
  danger: '#E74C3C',
  warning: '#F39C12',
  info: '#3498DB',
  purple: '#9B59B6',
  pink: '#E91E63'
};

const { width: screenWidth } = Dimensions.get('window');
const chartWidth = screenWidth - 40;
const chartHeight = 200;

const UserStatisticsScreen = ({ route, navigation }) => {
  const { currentUser, userPosts = [], userId } = route.params;
  
  const [loading, setLoading] = useState(true);
  const [selectedTab, setSelectedTab] = useState('likes');
  const [statsData, setStatsData] = useState({
    totalLikes: 0,
    totalFollowers: 0,
    totalPosts: 0,
    averageLikes: 0,
    likesProgression: [],
    followersGrowth: [],
    categoriesDistribution: []
  });

  useEffect(() => {
    loadStatisticsData();
  }, [userId, userPosts]);

  const loadStatisticsData = async () => {
    setLoading(true);
    
    try {
      console.log('Loading statistics data');
      
      const realUserData = statisticsService.processRealUserData(userPosts, userId);
      
      try {
        const followersResult = await statisticsService.getFollowersGrowth(userId);
        if (followersResult.success && followersResult.data) {
          realUserData.followersGrowth = followersResult.data;
          realUserData.totalFollowers = followersResult.currentFollowersCount || 0;
          console.log('Followers data retrieved successfully');
        } else {
          console.log('No followers data available');
          realUserData.followersGrowth = [];
          realUserData.totalFollowers = 0;
        }
      } catch (followersError) {
        console.log('Could not fetch followers data');
        realUserData.followersGrowth = [];
        realUserData.totalFollowers = 0;
      }
      
      setStatsData(realUserData);
      console.log('Statistics loaded successfully');
      
    } catch (error) {
      console.error('Statistics loading failed');
      
      const fallbackData = statisticsService.processRealUserData(userPosts, userId);
      setStatsData(fallbackData);
      console.log('Using fallback data');
    } finally {
      setLoading(false);
    }
  };

  const renderLikesChart = () => {
    if (!statsData.likesProgression || statsData.likesProgression.length === 0) {
      return (
        <View style={styles.chartContainer}>
          <Text style={styles.chartTitle}>Likes Progress per Recipe</Text>
          <View style={styles.emptyChartContainer}>
            <Ionicons name="trending-up-outline" size={60} color={FLAVORWORLD_COLORS.textLight} />
            <Text style={styles.emptyChartText}>No recipes yet</Text>
            <Text style={styles.emptyChartSubtext}>Start sharing recipes to see your likes progress!</Text>
          </View>
        </View>
      );
    }

    const margin = { top: 20, right: 20, bottom: 40, left: 40 };
    const width = chartWidth - margin.left - margin.right;
    const height = chartHeight - margin.top - margin.bottom;

    const xScale = d3.scaleLinear()
      .domain([1, statsData.likesProgression.length])
      .range([0, width]);

    const yScale = d3.scaleLinear()
      .domain([0, d3.max(statsData.likesProgression, d => d.likes) || 10])
      .range([height, 0]);

    const line = d3.line()
      .x(d => xScale(d.postIndex))
      .y(d => yScale(d.likes))
      .curve(d3.curveMonotoneX);

    const pathData = line(statsData.likesProgression);

    return (
      <View style={styles.chartContainer}>
        <Text style={styles.chartTitle}>Likes Progress per Recipe</Text>
        <Svg width={chartWidth} height={chartHeight}>
          <Defs>
            <LinearGradient id="likesGradient" x1="0%" y1="0%" x2="0%" y2="100%">
              <Stop offset="0%" stopColor={FLAVORWORLD_COLORS.primary} stopOpacity="0.8" />
              <Stop offset="100%" stopColor={FLAVORWORLD_COLORS.primary} stopOpacity="0.1" />
            </LinearGradient>
          </Defs>
          
          <G x={margin.left} y={margin.top}>
            {/**/}
            {yScale.ticks(5).map((tick, index) => (
              <Line
                key={index}
                x1={0}
                y1={yScale(tick)}
                x2={width}
                y2={yScale(tick)}
                stroke={FLAVORWORLD_COLORS.border}
                strokeWidth="1"
                opacity="0.3"
              />
            ))}
            
            {/**/}
            <Path
              d={pathData}
              fill="none"
              stroke={FLAVORWORLD_COLORS.primary}
              strokeWidth="3"
              strokeLinecap="round"
            />
            
            {/**/}
            {statsData.likesProgression.map((point, index) => (
              <Circle
                key={index}
                cx={xScale(point.postIndex)}
                cy={yScale(point.likes)}
                r="4"
                fill={FLAVORWORLD_COLORS.primary}
                stroke={FLAVORWORLD_COLORS.white}
                strokeWidth="2"
              />
            ))}
            
            {/**/}
            {yScale.ticks(5).map((tick, index) => (
              <SvgText
                key={index}
                x="-10"
                y={yScale(tick)}
                fontSize="12"
                fill={FLAVORWORLD_COLORS.textLight}
                textAnchor="end"
                alignmentBaseline="middle"
              >
                {tick}
              </SvgText>
            ))}
            
            {/**/}
            {statsData.likesProgression.filter((_, i) => i % 2 === 0).map((point, index) => (
              <SvgText
                key={index}
                x={xScale(point.postIndex)}
                y={height + 25}
                fontSize="10"
                fill={FLAVORWORLD_COLORS.textLight}
                textAnchor="middle"
              >
                Recipe {point.postIndex}
              </SvgText>
            ))}
          </G>
        </Svg>
      </View>
    );
  };

  const renderFollowersChart = () => {
    if (!statsData.followersGrowth || statsData.followersGrowth.length === 0) {
      return (
        <View style={styles.chartContainer}>
          <Text style={styles.chartTitle}>Followers Growth Over Time</Text>
          <View style={styles.emptyChartContainer}>
            <Ionicons name="people-outline" size={60} color={FLAVORWORLD_COLORS.textLight} />
            <Text style={styles.emptyChartText}>No followers data yet</Text>
            <Text style={styles.emptyChartSubtext}>Followers growth data will appear here</Text>
          </View>
        </View>
      );
    }

    const margin = { top: 20, right: 20, bottom: 40, left: 40 };
    const width = chartWidth - margin.left - margin.right;
    const height = chartHeight - margin.top - margin.bottom;

    const xScale = d3.scaleBand()
      .domain(statsData.followersGrowth.map(d => d.month))
      .range([0, width])
      .padding(0.1);

    const yScale = d3.scaleLinear()
      .domain([0, d3.max(statsData.followersGrowth, d => d.followers) || 10])
      .range([height, 0]);

    return (
      <View style={styles.chartContainer}>
        <Text style={styles.chartTitle}>Followers Growth Over Time</Text>
        <Svg width={chartWidth} height={chartHeight}>
          <G x={margin.left} y={margin.top}>
            {/**/}
            {yScale.ticks(5).map((tick, index) => (
              <Line
                key={index}
                x1={0}
                y1={yScale(tick)}
                x2={width}
                y2={yScale(tick)}
                stroke={FLAVORWORLD_COLORS.border}
                strokeWidth="1"
                opacity="0.3"
              />
            ))}
            
            {/**/}
            {statsData.followersGrowth.map((point, index) => (
              <Rect
                key={index}
                x={xScale(point.month)}
                y={yScale(point.followers)}
                width={xScale.bandwidth()}
                height={height - yScale(point.followers)}
                fill={FLAVORWORLD_COLORS.secondary}
                rx="4"
              />
            ))}
            
            {/**/}
            {yScale.ticks(5).map((tick, index) => (
              <SvgText
                key={index}
                x="-10"
                y={yScale(tick)}
                fontSize="12"
                fill={FLAVORWORLD_COLORS.textLight}
                textAnchor="end"
                alignmentBaseline="middle"
              >
                {tick}
              </SvgText>
            ))}
            
            {/**/}
            {statsData.followersGrowth.map((point, index) => (
              <SvgText
                key={index}
                x={xScale(point.month) + xScale.bandwidth() / 2}
                y={height + 25}
                fontSize="12"
                fill={FLAVORWORLD_COLORS.textLight}
                textAnchor="middle"
              >
                {point.month}
              </SvgText>
            ))}
          </G>
        </Svg>
      </View>
    );
  };

  const renderCategoriesChart = () => {
    if (!statsData.categoriesDistribution || statsData.categoriesDistribution.length === 0) {
      return (
        <View style={styles.chartContainer}>
          <Text style={styles.chartTitle}>Recipe Categories Distribution</Text>
          <View style={styles.emptyChartContainer}>
            <Ionicons name="pie-chart-outline" size={60} color={FLAVORWORLD_COLORS.textLight} />
            <Text style={styles.emptyChartText}>No categories yet</Text>
            <Text style={styles.emptyChartSubtext}>Share recipes with different categories to see distribution</Text>
          </View>
        </View>
      );
    }

    const radius = Math.min(chartWidth, chartHeight) / 2 - 40;
    const centerX = chartWidth / 2;
    const centerY = chartHeight / 2;

    const colors = [
      FLAVORWORLD_COLORS.primary,
      FLAVORWORLD_COLORS.secondary,
      FLAVORWORLD_COLORS.accent,
      FLAVORWORLD_COLORS.success,
      FLAVORWORLD_COLORS.warning,
      FLAVORWORLD_COLORS.info,
      FLAVORWORLD_COLORS.purple,
      FLAVORWORLD_COLORS.pink
    ];

    const pie = d3.pie()
      .value(d => d.count)
      .sort(null);

    const arc = d3.arc()
      .innerRadius(radius * 0.4)
      .outerRadius(radius);

    const pieData = pie(statsData.categoriesDistribution);

    return (
      <View style={styles.chartContainer}>
        <Text style={styles.chartTitle}>Recipe Categories Distribution</Text>
        <Svg width={chartWidth} height={chartHeight}>
          <G x={centerX} y={centerY}>
            {pieData.map((slice, index) => {
              const pathData = arc(slice);
              const labelPos = arc.centroid(slice);
              
              return (
                <G key={index}>
                  <Path
                    d={pathData}
                    fill={colors[index % colors.length]}
                    stroke={FLAVORWORLD_COLORS.white}
                    strokeWidth="2"
                  />
                  <SvgText
                    x={labelPos[0]}
                    y={labelPos[1]}
                    fontSize="12"
                    fill={FLAVORWORLD_COLORS.white}
                    textAnchor="middle"
                    alignmentBaseline="middle"
                    fontWeight="bold"
                  >
                    {slice.data.count}
                  </SvgText>
                </G>
              );
            })}
          </G>
        </Svg>
        
        {/**/}
        <View style={styles.legend}>
          {statsData.categoriesDistribution.map((item, index) => (
            <View key={index} style={styles.legendItem}>
              <View 
                style={[
                  styles.legendColor,
                  { backgroundColor: colors[index % colors.length] }
                ]}
              />
              <Text style={styles.legendText}>
                {item.category} ({item.count})
              </Text>
            </View>
          ))}
        </View>
      </View>
    );
  };

  const renderStatsCards = () => (
    <View style={styles.statsCards}>
      <View style={styles.statCard}>
        <View style={styles.statIcon}>
          <Ionicons name="heart" size={24} color={FLAVORWORLD_COLORS.danger} />
        </View>
        <Text style={styles.statNumber}>{statsData.totalLikes}</Text>
        <Text style={styles.statLabel}>Total Likes</Text>
      </View>
      
      <View style={styles.statCard}>
        <View style={styles.statIcon}>
          <Ionicons name="people" size={24} color={FLAVORWORLD_COLORS.secondary} />
        </View>
        <Text style={styles.statNumber}>{statsData.totalFollowers}</Text>
        <Text style={styles.statLabel}>Followers</Text>
      </View>
      
      <View style={styles.statCard}>
        <View style={styles.statIcon}>
          <Ionicons name="restaurant" size={24} color={FLAVORWORLD_COLORS.primary} />
        </View>
        <Text style={styles.statNumber}>{statsData.totalPosts}</Text>
        <Text style={styles.statLabel}>Recipes</Text>
      </View>
      
      <View style={styles.statCard}>
        <View style={styles.statIcon}>
          <Ionicons name="star" size={24} color={FLAVORWORLD_COLORS.warning} />
        </View>
        <Text style={styles.statNumber}>{statsData.averageLikes}</Text>
        <Text style={styles.statLabel}>Avg Likes</Text>
      </View>
    </View>
  );

  const renderTabBar = () => (
    <View style={styles.tabContainer}>
      {[
        { key: 'likes', label: 'Likes Progress', icon: 'trending-up' },
        { key: 'followers', label: 'Followers Growth', icon: 'people' },
        { key: 'categories', label: 'Categories', icon: 'pie-chart' }
      ].map(tab => (
        <TouchableOpacity
          key={tab.key}
          style={[
            styles.tab,
            selectedTab === tab.key && styles.activeTab
          ]}
          onPress={() => setSelectedTab(tab.key)}
        >
          <Ionicons 
            name={tab.icon} 
            size={20} 
            color={selectedTab === tab.key ? FLAVORWORLD_COLORS.white : FLAVORWORLD_COLORS.textLight}
          />
          <Text style={[
            styles.tabText,
            selectedTab === tab.key && styles.activeTabText
          ]}>
            {tab.label}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );

  const renderCurrentChart = () => {
    if (loading) {
      return (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={FLAVORWORLD_COLORS.primary} />
          <Text style={styles.loadingText}>Loading statistics...</Text>
        </View>
      );
    }

    switch (selectedTab) {
      case 'likes':
        return renderLikesChart();
      case 'followers':
        return renderFollowersChart();
      case 'categories':
        return renderCategoriesChart();
      default:
        return null;
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity 
            style={styles.backButton} 
            onPress={() => navigation.goBack()}
          >
            <Ionicons name="arrow-back" size={24} color={FLAVORWORLD_COLORS.accent} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>My Statistics</Text>
          <View style={styles.placeholder} />
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={FLAVORWORLD_COLORS.primary} />
          <Text style={styles.loadingText}>Loading your cooking statistics...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.backButton} 
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={24} color={FLAVORWORLD_COLORS.accent} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>My Statistics</Text>
        <View style={styles.placeholder} />
      </View>
      
      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {renderStatsCards()}
        {renderTabBar()}
        {renderCurrentChart()}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: FLAVORWORLD_COLORS.background,
  },
  
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: FLAVORWORLD_COLORS.white,
    borderBottomWidth: 1,
    borderBottomColor: FLAVORWORLD_COLORS.border,
  },
  
  backButton: {
    padding: 8,
    backgroundColor: FLAVORWORLD_COLORS.background,
    borderRadius: 20,
  },
  
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: FLAVORWORLD_COLORS.text,
    flex: 1,
    textAlign: 'center',
  },
  
  placeholder: {
    width: 40,
  },
  
  content: {
    flex: 1,
    padding: 20,
  },
  
  statsCards: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 25,
  },
  
  statCard: {
    backgroundColor: FLAVORWORLD_COLORS.white,
    borderRadius: 15,
    padding: 20,
    alignItems: 'center',
    width: (screenWidth - 60) / 2,
    marginBottom: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  
  statIcon: {
    marginBottom: 10,
  },
  
  statNumber: {
    fontSize: 24,
    fontWeight: 'bold',
    color: FLAVORWORLD_COLORS.text,
    marginBottom: 5,
  },
  
  statLabel: {
    fontSize: 14,
    color: FLAVORWORLD_COLORS.textLight,
    fontWeight: '500',
  },
  
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: FLAVORWORLD_COLORS.white,
    borderRadius: 12,
    padding: 4,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: 8,
    gap: 6,
  },
  
  activeTab: {
    backgroundColor: FLAVORWORLD_COLORS.primary,
  },
  
  tabText: {
    fontSize: 12,
    fontWeight: '600',
    color: FLAVORWORLD_COLORS.textLight,
  },
  
  activeTabText: {
    color: FLAVORWORLD_COLORS.white,
  },
  
  chartContainer: {
    backgroundColor: FLAVORWORLD_COLORS.white,
    borderRadius: 15,
    padding: 20,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  
  chartTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: FLAVORWORLD_COLORS.text,
    marginBottom: 15,
    textAlign: 'center',
  },
  
  legend: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    marginTop: 15,
    gap: 10,
  },
  
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 5,
    marginVertical: 2,
  },
  
  legendColor: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 6,
  },
  
  legendText: {
    fontSize: 12,
    color: FLAVORWORLD_COLORS.textLight,
  },
  
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  
  loadingText: {
    fontSize: 16,
    color: FLAVORWORLD_COLORS.textLight,
    textAlign: 'center',
    marginTop: 15,
  },

  emptyChartContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
    paddingHorizontal: 20,
  },

  emptyChartText: {
    fontSize: 18,
    fontWeight: '600',
    color: FLAVORWORLD_COLORS.text,
    marginTop: 15,
    marginBottom: 8,
  },

  emptyChartSubtext: {
    fontSize: 14,
    color: FLAVORWORLD_COLORS.textLight,
    textAlign: 'center',
    lineHeight: 20,
  },
});

export default UserStatisticsScreen;