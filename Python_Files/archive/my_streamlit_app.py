import streamlit as st

st.title("My First Streamlit App 🚀")

name = st.text_input("Enter your name:")
age = st.slider("Select your age:", 0, 100, 25)

if st.button("Say Hello"):
    st.write(f"Hello {name}, you are {age} years old! 🎉")
