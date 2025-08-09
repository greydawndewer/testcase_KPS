using kpsk.Models;
using System;
using System.Collections.Generic;
using System.Collections.ObjectModel;
using System.Linq;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Data;
using System.Windows.Input;
using System.Windows.Media;
using System.Windows.Media.Imaging;

namespace kpsk.Pages
{
    public partial class Marketplace : Page
    {
        private ObservableCollection<ProductModel> AllProducts;
        public ObservableCollection<ProductModel> FilteredProducts { get; set; }
        private UserData userData;

        public Marketplace()
        {
            InitializeComponent();
            InitializeProducts();
        }


        private void InitializeProducts()
        {
            AllProducts = new ObservableCollection<ProductModel>
            {
                new ProductModel {
                    Id=1,
                    Name="DIY Flying Photoframe ",
                    Description="Cardboard, Chartpaper, Thread, Acrylic Colour.",
                    Price=129.99,
                    ImagePath="Assets/ab1.jpg",
                    Image = LoadImage("Assets/ab1.jpg")
                },
                new ProductModel {
                    Id=2,
                    Name="Magical Bottle",
                    Description="Glass Bottle, Acrylic colour.",
                    Price=199.99,
                    ImagePath="Assets/ab2.jpg",
                    Image = LoadImage("Assets/ab2.jpg")
                },
                new ProductModel {
                    Id=3,
                    Name="Astonishing Rainbow",
                    Description="Plastic Bottle, Clay.",
                    Price=39.99,
                    ImagePath="Assets/ab3.jpg",
                    Image = LoadImage("Assets/ab3.jpg")
                },
            };

            // Update bought status
            foreach (var product in AllProducts)
            {
                product.IsBought = DataService.UserData.BoughtProductIds.Contains(product.Id);
            }


            FilteredProducts = new ObservableCollection<ProductModel>(AllProducts);
            DataContext = this;
        }
        private BitmapImage LoadImage(string path)
        {
            try
            {
                var bitmap = new BitmapImage();
                bitmap.BeginInit();
                bitmap.CacheOption = BitmapCacheOption.OnLoad;
                bitmap.UriSource = new Uri($"pack://application:,,,/{path}");
                bitmap.EndInit();
                return bitmap;
            }
            catch
            {
                return new BitmapImage(); // Return empty image on error
            }
        }

        // New event handler for image clicks


  
        // New event handler for closing full screen
  

        // New event handler for clicking on full screen image

        private void SearchButton_Click(object sender, RoutedEventArgs e)
        {
            ApplySearchFilter();
        }

        private void ApplySearchFilter()
        {
            var query = SearchBox.Text.Trim().ToLower();

            FilteredProducts.Clear();

            var results = string.IsNullOrWhiteSpace(query)
                ? AllProducts
                : AllProducts.Where(p =>
                    p.Name.ToLower().Contains(query) ||
                    p.Description.ToLower().Contains(query));

            foreach (var product in results)
            {
                FilteredProducts.Add(product);
            }
        }

        private void SearchBox_GotFocus(object sender, RoutedEventArgs e)
        {
            if (SearchBox.Text == "Search products...")
            {
                SearchBox.Text = "";
                SearchBox.Foreground = Brushes.White;
            }
        }

        private void SearchBox_LostFocus(object sender, RoutedEventArgs e)
        {
            if (string.IsNullOrWhiteSpace(SearchBox.Text))
            {
                SearchBox.Text = "Search products...";
                SearchBox.Foreground = Brushes.White;
            }
        }

        private void SearchBox_TextChanged(object sender, TextChangedEventArgs e)
        {
            if (Keyboard.IsKeyDown(Key.Enter))
                SearchButton_Click(null, null);
        }
        private void BuyButton_Click(object sender, RoutedEventArgs e)
        {
            if (e.Source is Button button && button.CommandParameter is int productId)
            {
                var product = AllProducts.FirstOrDefault(p => p.Id == productId);
                if (product != null && !product.IsBought)
                {
                    product.IsBought = true;
                    DataService.UserData.BoughtProductIds.Add(productId);
                    DataService.SaveUserData();

                    // Refresh view
                    var index = AllProducts.IndexOf(product);
                    AllProducts[index] = product;
                }
            }
        }

        private void SaveUserData()
        {
            try
            {
                var json = Newtonsoft.Json.JsonConvert.SerializeObject(userData);
                System.IO.File.WriteAllText("userdata.json", json);
            }
            catch (Exception ex)
            {
                MessageBox.Show($"Error saving data: {ex.Message}");
            }
        }
    }

    public class UserData
    {
        public List<int> BoughtProductIds { get; set; } = new List<int>();
    }

    public class InverseBooleanConverter : IValueConverter
    {
        public object Convert(object value, Type targetType, object parameter, System.Globalization.CultureInfo culture)
        {
            return !(bool)(value ?? false);
        }

        public object ConvertBack(object value, Type targetType, object parameter, System.Globalization.CultureInfo culture)
        {
            throw new NotSupportedException();
        }
    }
}