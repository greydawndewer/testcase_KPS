using kpsk.Models;
using kpsk.Pages;
using Newtonsoft.Json;
using System;
using System.Collections.Generic;
using System.Collections.ObjectModel;
using System.IO;
using System.Linq;
using System.Windows;
using System.Windows.Controls;

namespace kpsk
{
    public partial class MainWindow : Window
    {
        private ObservableCollection<ProductModel> boughtProducts = new ObservableCollection<ProductModel>();
        private UserData userData;

        public MainWindow()
        {
            InitializeComponent();
            LoadBoughtProducts();
        }

        private void LoadBoughtProducts()
        {
            boughtProducts.Clear();
            var userData = DataService.UserData;
            if (userData.BoughtProductIds.Count > 0)
            {
                var allProducts = new List<ProductModel>
                {
                new ProductModel {
                    Id=1,
                    Name="DIY Flying Photoframe ",
                    Description="Cardboard, Chartpaper, Thread, Acrylic Colour.",
                    Price=129.99,
                    ImagePath="Assets/ab1.jpg",
                },
                new ProductModel {
                    Id=2,
                    Name="Magical Bottle",
                    Description="Glass Bottle, Acrylic colour.",
                    Price=199.99,
                    ImagePath="Assets/ab2.jpg",
                },
                new ProductModel {
                    Id=3,
                    Name="Astonishing Rainbow",
                    Description="Plastic Bottle, Clay.",
                    Price=39.99,
                    ImagePath="Assets/ab3.jpg",
                },
                };

                foreach (var product in allProducts)
                {
                    if (userData.BoughtProductIds.Contains(product.Id))
                    {
                        product.IsBought = true;
                        boughtProducts.Add(product);
                    }
                }

            }
            else
            {
                boughtProducts.Add(new ProductModel
                {
                    Id = -1,
                    Name = "No purchases yet",
                    Description = "Visit the Marketplace to buy products",
                    Price = 0,
                    ImagePath = "Assets/asa.jpg",
                });
            }

            BoughtProductsList.ItemsSource = boughtProducts;
        }

        private void Videos_Click(object sender, RoutedEventArgs e)
        {
            ShowContentFrame();
            MainFrame.Navigate(new Uri("Pages/Videos.xaml", UriKind.Relative));
        }

        private void Home_Click(object sender, EventArgs e)
        {
            ShowBoughtProducts();
            LoadBoughtProducts(); // Refresh when navigating home
        }

        private void Marketplace_Click(object sender, RoutedEventArgs e)
        {
            ShowContentFrame();
            // Create new instance to force refresh
            MainFrame.Navigate(new Marketplace());
        }

        private void ShowBoughtProducts()
        {
            BoughtProductsContainer.Visibility = Visibility.Visible;
            MainFrame.Visibility = Visibility.Collapsed;
            LoadBoughtProducts();
        }

        private void ShowContentFrame()
        {
            BoughtProductsContainer.Visibility = Visibility.Collapsed;
            MainFrame.Visibility = Visibility.Visible;
        }

        private void RemoveButton_Click(object sender, RoutedEventArgs e)
        {
            if (e.Source is Button button && button.CommandParameter is int productId && productId > 0)
            {
                DataService.UserData.BoughtProductIds.Remove(productId);
                DataService.SaveUserData();
                LoadBoughtProducts(); // Refresh view
            }
        }
    }

    public class UserData
    {
        public List<int> BoughtProductIds { get; set; } = new List<int>();
    }
}