import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export const Container = ({ children }: { children: React.ReactNode }) => {
  const insets = useSafeAreaInsets();
  
  return (
    <View 
      style={[
        styles.container,
        {
          paddingTop: insets.top + 16,
          paddingBottom: insets.bottom + 16,
          paddingLeft: 24,
          paddingRight: 24,
        }
      ]}
    >
      {children}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
